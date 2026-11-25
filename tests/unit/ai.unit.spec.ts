import type { AdapterContext, LLMProvider, LLMRequest } from '@promisetracker/kernel'
import {
  ConfigurationError,
  createKernel,
  ExternalServiceError,
  resetCircuitBreakers,
} from '@promisetracker/kernel'
import type { FirstPassCandidate } from '@promisetracker/plugin-ai'
import {
  aiPlugin,
  checkCandidates,
  configureAi,
  credentials,
  extractCandidates,
  extractCandidatesTask,
  isCreditExhausted,
  llmProviders,
  MAX_SECTIONS,
  ollamaUrl,
  PROMPT_VERSION,
  quoteAppears,
  SECTION_CHARS,
  SECTION_OVERLAP,
  sections,
  toServiceError,
  VENDORS,
} from '@promisetracker/plugin-ai'
import { corePlugin, SECRET_MASK } from '@promisetracker/plugin-core'
import { APICallError } from 'ai'
import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * plugin-ai without a database or a real key (sections 6.1 and 9.5): the
 * vendors, the sections, the quote check, both passes with a stub provider,
 * exhausted credit, and the health check's test request.
 */

const ctx = (settings: Record<string, unknown> = {}): AdapterContext => ({
  payload: {} as Payload,
  logger: { info: () => {}, warn: () => {}, error: () => {} } as never,
  signal: new AbortController().signal,
  settings,
})

const apiError = (statusCode: number, body = '', headers: Record<string, string> = {}) =>
  new APICallError({
    message: 'provider error',
    url: 'https://vendor.example/v1',
    requestBodyValues: {},
    statusCode,
    responseHeaders: headers,
    responseBody: body,
  })

/** A provider that answers each call from a list, and records what it was asked. */
function stub(answers: ((request: LLMRequest) => unknown)[]): LLMProvider & {
  requests: LLMRequest[]
} {
  const requests: LLMRequest[] = []
  return {
    id: 'stub',
    models: [],
    requests,
    health: async () => ({ healthy: true }),
    generate: async (request) => {
      requests.push(request)
      const answer = answers[requests.length - 1] ?? answers.at(-1)
      if (!answer) throw new Error('No answer left')
      const output = answer(request)
      if (output instanceof Error) throw output
      return { output, usage: { inputTokens: 100, outputTokens: 10 } }
    },
  }
}

const run = (text: string, llm: LLMProvider) =>
  extractCandidates({
    title: 'Manifesto',
    text,
    llm,
    model: 'test',
    context: async (signal) => ({ ...ctx(), signal }),
    signal: new AbortController().signal,
  })

afterEach(() => {
  resetCircuitBreakers()
  vi.restoreAllMocks()
})

describe('the vendors', () => {
  it('carries over every vendor v2 supported, each an adapter', () => {
    expect(VENDORS.map((v) => v.id)).toEqual([
      'google',
      'xai',
      'openai',
      'anthropic',
      'mistral',
      'deepseek',
      'cerebras',
      'groq',
      'togetherai',
      'cohere',
      'fireworks',
      'deepinfra',
      'perplexity',
      'ollama',
    ])
    expect(llmProviders.map((p) => p.id)).toEqual(VENDORS.map((v) => v.id))
  })

  it('takes the model from PT_LLM_MODEL', () => {
    const kernel = createKernel({
      plugins: [corePlugin, aiPlugin],
      env: { PT_PLUGINS: 'core,ai', PT_LLM_MODEL: 'anthropic:claude-sonnet-4-5' },
    })
    expect(kernel.adapters.llm?.adapter.id).toBe('anthropic')
    expect(kernel.adapters.llm?.model).toBe('claude-sonnet-4-5')
    expect(() =>
      createKernel({ plugins: [corePlugin, aiPlugin], env: { PT_PLUGINS: 'core,ai' } }),
    ).toThrow(/PT_LLM_MODEL is not set/)
  })

  it('reads the key from the settings, and refuses a masked or missing one', () => {
    const google = VENDORS[0]
    if (!google) throw new Error('no vendor')
    expect(credentials(google, { apiKey: ' key ' })).toEqual({ apiKey: 'key' })
    expect(() => credentials(google, {})).toThrow(ConfigurationError)
    expect(() => credentials(google, { apiKey: SECRET_MASK })).toThrow(/masked/)
    const ollama = VENDORS.find((v) => v.id === 'ollama')
    if (!ollama) throw new Error('no ollama')
    expect(credentials(ollama, {})).toEqual({})
  })

  it("adds /v1 to Ollama's address", () => {
    expect(ollamaUrl(undefined)).toBe('http://127.0.0.1:11434/v1')
    expect(ollamaUrl('http://ollama:11434')).toBe('http://ollama:11434/v1')
    expect(ollamaUrl('http://ollama:11434/v1/')).toBe('http://ollama:11434/v1')
    expect(ollamaUrl('http://ollama:11434/v1/chat')).toBe('http://ollama:11434/v1')
  })
})

describe('failures', () => {
  it('knows exhausted credit, however the vendor says it', () => {
    expect(isCreditExhausted(apiError(402))).toBe(true)
    expect(isCreditExhausted(apiError(429, '{"error":{"code":"insufficient_quota"}}'))).toBe(true)
    expect(isCreditExhausted(apiError(400, 'Your credit balance is too low'))).toBe(true)
    expect(isCreditExhausted(apiError(429, 'RESOURCE_EXHAUSTED'))).toBe(true)
    expect(isCreditExhausted(apiError(429, 'slow down'))).toBe(false)
    expect(isCreditExhausted(new Error('402'))).toBe(false)
  })

  it('maps vendor errors to the retry rules in section 9.7', () => {
    const credit = toServiceError('openai', apiError(402))
    expect(credit.code).toBe('external.credit-exhausted')
    expect(credit.retryable).toBe(false)
    const limited = toServiceError('openai', apiError(429, 'slow down', { 'retry-after': '5' }))
    expect(limited.failure).toBe('rate-limited')
    expect(limited.retryAfterMs).toBe(5_000)
    expect(toServiceError('openai', apiError(401)).failure).toBe('unauthorized')
    expect(toServiceError('openai', apiError(503)).retryable).toBe(true)
    expect(toServiceError('openai', new TypeError('fetch failed')).failure).toBe('unavailable')
    expect(toServiceError('openai', apiError(503)).service).toBe('ai:openai')
  })
})

describe('the health check', () => {
  const openai = llmProviders.find((p) => p.id === 'openai')
  if (!openai) throw new Error('no openai')

  it('makes a small test request, and reports exhausted credit as degraded', async () => {
    configureAi({ llm: { adapter: openai, model: 'gpt-test' } })
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":{"code":"insufficient_quota","message":"quota"}}', {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const report = await openai.health(ctx({ apiKey: 'sk-test-credit' }))
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(report).toEqual({ healthy: false, detail: 'external.credit-exhausted' })
    // The answer is reused for a minute, so a monitor does not run up a bill.
    await openai.health(ctx({ apiKey: 'sk-test-credit' }))
    expect(fetch).toHaveBeenCalledTimes(1)
    // The detail never names the key.
    expect(JSON.stringify(report)).not.toContain('sk-test')
  })

  it('reports a missing key, and says nothing for vendors not chosen', async () => {
    configureAi({ llm: { adapter: openai, model: 'gpt-test' } })
    expect(await openai.health(ctx())).toEqual({ healthy: false, detail: 'configuration' })
    const google = llmProviders.find((p) => p.id === 'google')
    expect(await google?.health(ctx())).toEqual({ healthy: true, detail: 'not selected' })
    configureAi({ llm: null })
  })
})

describe('sections', () => {
  it('keeps a short text whole', () => {
    expect(sections('  One section.  ')).toEqual(['One section.'])
    expect(sections('   ')).toEqual([])
  })

  it('splits a long text into overlapping sections at sentence ends', () => {
    const sentence = 'The government will build a new road in every county. '
    const text = sentence.repeat(Math.ceil((SECTION_CHARS * 2.5) / sentence.length))
    const parts = sections(text)
    expect(parts.length).toBeGreaterThanOrEqual(3)
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(SECTION_CHARS)
      expect(part.endsWith('.')).toBe(true)
    }
    // Each section starts inside the last one, so no sentence is lost at a cut.
    const [first = '', second = ''] = parts
    expect(first.includes(second.slice(0, SECTION_OVERLAP / 2))).toBe(true)
  })
})

/**
 * v2's quote checks (`mergeByAtomicPromise` and `hasVerifiableQuote` in
 * `src/tasks/extractPromises.ts`), carried over.
 */
describe('the quote check', () => {
  const text = 'We will build 100 hospitals.\nWe will hire\n  5,000 nurses by 2027.'

  it('accepts a quote that is in the text, whatever its spacing or case', () => {
    expect(quoteAppears(text, 'We will build 100 hospitals.')).toBe(true)
    expect(quoteAppears(text, 'we will hire 5,000 nurses')).toBe(true)
  })

  it('refuses a changed word, a paraphrase, or a quote too short to prove anything', () => {
    expect(quoteAppears(text, 'We will build 200 hospitals.')).toBe(false)
    expect(quoteAppears(text, 'Hospitals will be built')).toBe(false)
    expect(quoteAppears(text, 'We will')).toBe(false)
  })

  it('keeps accents: a French quote must match its own letters', () => {
    const french = 'Nous créerons 500 000 emplois d’ici à 2027.'
    expect(quoteAppears(french, 'Nous créerons 500 000 emplois')).toBe(true)
    expect(quoteAppears(french, 'Nous creerons 500 000 emplois')).toBe(false)
  })

  const candidate = (summary: string, quotes: string[], topic = 'Health'): FirstPassCandidate => ({
    topic,
    summary,
    quotes,
    confidence: 0.8,
  })

  it('drops invented quotes, and candidates left with none', () => {
    const checked = checkCandidates(
      [
        candidate('Build hospitals', ['We will build 100 hospitals.', 'An invented sentence here']),
        candidate('Cut taxes', ['We will cut every tax in half.']),
      ],
      text,
    )
    expect(checked).toEqual([candidate('Build hospitals', ['We will build 100 hospitals.'])])
  })

  it('merges duplicates, keeping the quotes of both once', () => {
    const checked = checkCandidates(
      [
        candidate('Build 100 hospitals.', ['We will build 100 hospitals.']),
        candidate('build 100 hospitals', [
          'we will build 100 hospitals.',
          'We will hire 5,000 nurses',
        ]),
      ],
      text,
    )
    expect(checked).toHaveLength(1)
    expect(checked[0]?.quotes).toEqual([
      'We will build 100 hospitals.',
      'We will hire 5,000 nurses',
    ])
  })

  it('keeps two commitments with the same summary under different topics apart', () => {
    const quote = ['We will build 100 hospitals.']
    expect(
      checkCandidates(
        [candidate('Build', quote, 'Health'), candidate('Build', quote, 'Jobs')],
        text,
      ),
    ).toHaveLength(2)
  })
})

describe('the extraction (section 9.5)', () => {
  const text =
    'Our plan. We will build 100 hospitals and hire 5,000 nurses by 2027. We believe in fairness.'

  const firstPass = () => ({
    candidates: [
      {
        topic: 'Health',
        summary: 'Build 100 hospitals and hire 5,000 nurses',
        quotes: ['We will build 100 hospitals and hire 5,000 nurses by 2027.'],
        confidence: 0.9,
      },
      // Invented: the quote is not in the text.
      {
        topic: 'Jobs',
        summary: 'Create a million jobs',
        quotes: ['We will create a million jobs.'],
        confidence: 0.9,
      },
    ],
  })

  const secondPass = () => ({
    candidates: [
      {
        title: 'Build 100 hospitals',
        topic: 'Health',
        summary: 'Build 100 hospitals by 2027',
        quotes: ['We will build 100 hospitals'],
        confidence: 0.9,
      },
      {
        title: 'Hire 5,000 nurses',
        topic: 'Health',
        summary: 'Hire 5,000 nurses by 2027',
        quotes: ['hire 5,000 nurses by 2027.'],
        confidence: 0.8,
      },
      // The second pass made a quote up, so the check runs again.
      {
        title: 'Free clinics',
        topic: 'Health',
        summary: 'Make clinics free',
        quotes: ['Clinics will be free for all.'],
        confidence: 0.5,
      },
    ],
  })

  it('runs both passes, splits the compound claim, and checks quotes after each', async () => {
    const llm = stub([firstPass, secondPass])
    const outcome = await run(text, llm)
    expect(outcome.candidates.map((c) => c.title)).toEqual([
      'Build 100 hospitals',
      'Hire 5,000 nurses',
    ])
    // The second pass only sees candidates whose quotes passed.
    const tidied = llm.requests[1]?.prompt ?? ''
    expect(tidied).toContain('Build 100 hospitals and hire 5,000 nurses')
    expect(tidied).not.toContain('Create a million jobs')
    // Token counts come from the port's results (#665).
    expect(outcome.usage).toEqual({ inputTokens: 200, outputTokens: 20 })
    expect(outcome.sections).toBe(1)
  })

  it('asks for structured output with instructions against merging', async () => {
    const llm = stub([firstPass, secondPass])
    await run(text, llm)
    const [first, second] = llm.requests
    expect(first?.system).toMatch(/Never merge two commitments/)
    expect(first?.system).toMatch(/own language/)
    expect(first?.outputSchema).toMatchObject({ type: 'object', required: ['candidates'] })
    expect(second?.system).toMatch(/Split any item/)
    expect(first?.model).toBe('test')
    expect(PROMPT_VERSION).toMatch(/^extract-v\d+$/)
  })

  it('skips the second pass when nothing survives the first', async () => {
    const llm = stub([() => ({ candidates: [] })])
    const outcome = await run(text, llm)
    expect(outcome.candidates).toEqual([])
    expect(llm.requests).toHaveLength(1)
  })

  it('loses only the section whose answer is the wrong shape', async () => {
    const sentence = 'We will build 100 hospitals and hire 5,000 nurses by 2027. '
    const long = sentence.repeat(Math.ceil((SECTION_CHARS * 1.5) / sentence.length))
    const llm = stub([() => ({ nonsense: true }), firstPass, secondPass])
    const outcome = await run(long, llm)
    expect(outcome.failedSections).toBe(1)
    expect(outcome.notes.join(' ')).toMatch(/could not be used for 1 of 2 sections/)
    expect(outcome.candidates.length).toBeGreaterThan(0)
  })

  it('fails when no section can be used, and stops at once on exhausted credit', async () => {
    await expect(run(text, stub([() => ({ nonsense: true })]))).rejects.toThrow(
      ExternalServiceError,
    )
    const credit = stub([() => toServiceError('stub', apiError(402))])
    await expect(run(text, credit)).rejects.toMatchObject({ code: 'external.credit-exhausted' })
    expect(credit.requests).toHaveLength(1)
  })

  it(`analyses at most ${MAX_SECTIONS} sections, and says so`, async () => {
    const block = `${'x'.repeat(SECTION_CHARS - 2)}. `
    const huge = block.repeat(MAX_SECTIONS + 5)
    const llm = stub([() => ({ candidates: [] })])
    const outcome = await run(huge, llm)
    expect(llm.requests.length).toBe(MAX_SECTIONS)
    expect(outcome.notes[0]).toMatch(new RegExp(`first ${MAX_SECTIONS} of`))
  })
})

describe('the job', () => {
  it('has one concurrency key per AI provider', () => {
    const openai = llmProviders.find((p) => p.id === 'openai')
    if (!openai) throw new Error('no openai')
    configureAi({ llm: { adapter: openai, model: 'gpt-test' } })
    const key = extractCandidatesTask.concurrency.key
    expect(key()).toBe('ai:openai')
    expect(extractCandidatesTask.concurrency.exclusive).toBe(true)
    configureAi({ llm: null })
    expect(key()).toBe('ai:none')
  })
})
