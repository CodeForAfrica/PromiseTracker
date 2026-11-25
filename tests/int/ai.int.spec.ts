import { vi } from 'vitest'

// plugin-ai is on for this file only. Every other test file reads documents
// and expects them to stop at "extracted". The schema is the same either way (D29).
vi.hoisted(() => {
  process.env.PT_PLUGINS = 'core,site,tika,ai'
  process.env.PT_LLM_MODEL = 'ollama:stub-model'
})

import { getHealth, getPayload } from '@promisetracker/cms'
import type { LLMProvider, LLMRequest } from '@promisetracker/kernel'
import { resetCircuitBreakers } from '@promisetracker/kernel'
import {
  configureAi,
  llmProviders,
  PROMPT_VERSION,
  toServiceError,
} from '@promisetracker/plugin-ai'
import type { CountryCode } from '@promisetracker/plugin-core'
import { setTagRefresher } from '@promisetracker/plugin-core'
import { APICallError } from 'ai'
import type { Payload, PayloadRequest } from 'payload'
import { createPayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * plugin-ai against the database, with a stub provider and no key (sections
 * 6.1, 7.8, 9.4, 9.5 and 13.2): a document read into text goes to AI, the
 * extraction is recorded, and a reviewer accepts or rejects each candidate.
 */
describe('plugin-ai', () => {
  let payload: Payload
  let country: string
  let actor: string
  type User = NonNullable<PayloadRequest['user']>
  const users: Partial<Record<'contributor' | 'reviewer' | 'editor', User>> = {}

  const TEXT = [
    'Our plan for Kenya.',
    'We will build 100 hospitals and hire 5,000 nurses by 2027.',
    'We believe in fairness for all.',
  ].join('\n\n')

  /** A provider whose answers come from the quotes in the prompt's own text. */
  const requests: LLMRequest[] = []
  let answer: (request: LLMRequest, call: number) => unknown = () => ({ candidates: [] })
  const stub: LLMProvider = {
    id: 'stub',
    models: [],
    health: async () => ({ healthy: true }),
    generate: async (request) => {
      requests.push(request)
      const output = answer(request, requests.length)
      if (output instanceof Error) throw output
      return { output, usage: { inputTokens: 120, outputTokens: 30 } }
    },
  }

  const twoPasses = (request: LLMRequest) =>
    request.prompt.startsWith('Section')
      ? {
          candidates: [
            {
              topic: 'Health',
              summary: 'Build 100 hospitals and hire 5,000 nurses',
              quotes: ['We will build 100 hospitals and hire 5,000 nurses by 2027.'],
              confidence: 0.9,
            },
          ],
        }
      : {
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
          ],
        }

  const user = async (role: 'contributor' | 'reviewer' | 'editor') => {
    const doc = await payload.create({
      collection: 'users',
      data: {
        email: `${role}-${crypto.randomUUID()}@example.org`,
        password: `pw-${crypto.randomUUID()}`,
        name: role,
        roles: [role],
      },
      overrideAccess: true,
    })
    users[role] = { ...doc, collection: 'users' } as User
  }

  /** Uploads a text file as a contributor and waits until the pipeline settles. */
  const upload = async (
    text: string,
    extra: Record<string, unknown> = {},
    done = ['analysed', 'needs-review', 'failed'],
  ) => {
    const data = Buffer.from(`${text}\n\nRef. ${crypto.randomUUID()}`)
    const file = await payload.create({
      collection: 'document-files',
      data: {},
      file: { data, mimetype: 'text/plain', name: 'manifesto.txt', size: data.length },
      user: users.contributor as User,
      overrideAccess: false,
    })
    const doc = await payload.create({
      collection: 'documents',
      data: {
        title: 'Manifesto',
        country,
        connector: 'upload',
        file: file.id,
        actors: [actor],
        language: 'en',
        ...extra,
      } as never,
      user: users.contributor as User,
      overrideAccess: false,
    })
    return settle(doc.id, done)
  }

  const settle = async (id: string, done: readonly string[]) => {
    const deadline = Date.now() + 30_000
    for (;;) {
      const now = await payload.findByID({ collection: 'documents', id, overrideAccess: true })
      if (done.includes(String(now.status))) return now
      if (Date.now() > deadline) throw new Error(`Still ${now.status}: ${now.statusMessage}`)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  const extractionsOf = async (document: string) =>
    (
      await payload.find({
        collection: 'extractions',
        where: { document: { equals: document } },
        sort: 'createdAt',
        depth: 0,
        overrideAccess: true,
      })
    ).docs

  const endpoint = async (
    path: string,
    role: keyof typeof users,
    params: Record<string, string>,
    body: Record<string, unknown> = {},
  ) => {
    const found = payload.collections.extractions.config.endpoints
      ? payload.collections.extractions.config.endpoints.find((e) => e.path === path)
      : undefined
    if (!found) throw new Error(`No ${path} endpoint.`)
    const req = await createPayloadRequest({ payload, user: users[role] as never })
    req.routeParams = params
    req.json = async () => body
    return found.handler(req)
  }

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async () => {})
    configureAi({ llm: { adapter: stub, model: 'stub-model' } })
    const [code = 'cv'] = (await unusedCountryCodes(payload, 1)) as CountryCode[]
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    actor = (
      await payload.create({
        collection: 'actors',
        locale: 'en',
        data: { name: 'Amina Wanjiru', kind: 'person', country } as never,
        overrideAccess: true,
      })
    ).id
    await user('contributor')
    await user('reviewer')
    await user('editor')
  })

  afterEach(() => {
    resetCircuitBreakers()
    requests.length = 0
  })

  afterAll(async () => {
    for (const collection of ['claims', 'documents', 'actors'] as const) {
      const { errors } = await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
        // Records in the trash too, so the country can go.
        trash: true,
      })
      expect(errors).toEqual([])
    }
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    for (const u of Object.values(users)) {
      if (u) await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
    }
  })

  it('analyses a document once it is read, and records the extraction', async () => {
    answer = twoPasses
    const doc = await upload(TEXT)
    expect(doc.status).toBe('analysed')
    expect(doc.statusMessage).toMatch(/2 candidate claims/)
    const [extraction] = await extractionsOf(doc.id)
    expect(extraction).toMatchObject({
      model: 'stub:stub-model',
      promptVersion: PROMPT_VERSION,
      status: 'completed',
      sections: 1,
      // Two calls: the first pass and the second, each 120 in and 30 out.
      inputTokens: 240,
      outputTokens: 60,
      pending: 2,
    })
    expect(extraction?.candidates?.map((c) => [c.title, c.decision])).toEqual([
      ['Build 100 hospitals', 'pending'],
      ['Hire 5,000 nurses', 'pending'],
    ])
  })

  it('leaves evidence alone: only a source of claims goes to AI', async () => {
    answer = twoPasses
    const doc = await upload(TEXT, { type: 'evidence' }, ['extracted', 'analysed', 'failed'])
    // Give a queued analysis the time it would take, then look again.
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    const settled = await payload.findByID({
      collection: 'documents',
      id: doc.id,
      overrideAccess: true,
    })
    expect(settled.status).toBe('extracted')
    expect(await extractionsOf(doc.id)).toEqual([])
  })

  it('marks a document with no usable candidates needs-review', async () => {
    // Every quote is made up, so the quote check discards them all.
    answer = () => ({
      candidates: [
        {
          topic: 'Jobs',
          summary: 'A million jobs',
          quotes: ['We will create a million jobs.'],
          confidence: 1,
        },
      ],
    })
    const doc = await upload(TEXT)
    expect(doc.status).toBe('needs-review')
    const [extraction] = await extractionsOf(doc.id)
    expect(extraction?.status).toBe('completed')
    expect(extraction?.candidates).toEqual([])
  })

  it('accepts a candidate as a claim on hold and unverified, entered by AI', async () => {
    answer = twoPasses
    const doc = await upload(TEXT)
    const [extraction] = await extractionsOf(doc.id)
    const [first, second] = extraction?.candidates ?? []
    if (!extraction || !first?.id || !second?.id) throw new Error('No candidates')
    const params = (candidate: string) => ({ id: extraction.id, candidate })

    // A contributor enters documents but does not review candidates (section 13.2).
    const refused = await endpoint(
      '/:id/candidates/:candidate/accept',
      'contributor',
      params(first.id),
    )
    expect(refused.status).toBe(403)

    const accepted = await endpoint(
      '/:id/candidates/:candidate/accept',
      'reviewer',
      params(first.id),
    )
    expect(accepted.status).toBe(200)
    const { claim: claimId } = (await accepted.json()) as { claim: string }
    const claim = await payload.findByID({
      collection: 'claims',
      id: claimId,
      depth: 0,
      overrideAccess: true,
    })
    expect(claim).toMatchObject({
      title: 'Build 100 hospitals',
      statement: 'We will build 100 hospitals',
      recordStatus: 'hold',
      extraction: 'ai',
      confidence: 0.9,
      source: doc.id,
      actor,
      enteredBy: users.reviewer?.id,
      ai: { extraction: extraction.id, candidate: first.id },
    })
    expect(claim.verification?.verdict ?? 'unverified').toBe('unverified')

    // Decided once.
    const again = await endpoint('/:id/candidates/:candidate/accept', 'reviewer', params(first.id))
    expect(again.status).toBe(409)

    // Rejecting needs a reason.
    const noReason = await endpoint(
      '/:id/candidates/:candidate/reject',
      'reviewer',
      params(second.id),
    )
    expect(noReason.status).toBe(400)
    const rejected = await endpoint(
      '/:id/candidates/:candidate/reject',
      'reviewer',
      params(second.id),
      { reason: 'The same as another claim.' },
    )
    expect(rejected.status).toBe(200)

    const [after] = await extractionsOf(doc.id)
    expect(after?.pending).toBe(0)
    expect(after?.candidates?.map((c) => [c.decision, c.reason])).toEqual([
      ['accepted', null],
      ['rejected', 'The same as another claim.'],
    ])
    expect(after?.candidates?.[0]?.reviewer).toBe(users.reviewer?.id)
  })

  it('accepts an edited candidate', async () => {
    answer = twoPasses
    const doc = await upload(TEXT)
    const [extraction] = await extractionsOf(doc.id)
    const [, nurses] = extraction?.candidates ?? []
    if (!extraction || !nurses?.id) throw new Error('No candidates')
    const res = await endpoint(
      '/:id/candidates/:candidate/accept',
      'editor',
      { id: extraction.id, candidate: nurses.id },
      { title: 'Hire 5,000 more nurses', summary: 'Nurses for every county' },
    )
    expect(res.status).toBe(200)
    const { claim } = (await res.json()) as { claim: string }
    const saved = await payload.findByID({ collection: 'claims', id: claim, overrideAccess: true })
    expect(saved.title).toBe('Hire 5,000 more nurses')
    expect(saved.summary).toBe('Nurses for every county')
  })

  it('keeps earlier extractions when AI runs again', async () => {
    answer = twoPasses
    const doc = await upload(TEXT)
    const res = await endpoint('/run', 'editor', {}, { document: doc.id })
    expect(res.status).toBe(200)
    // The endpoint starts the run without waiting for a worker.
    const deadline = Date.now() + 30_000
    let all = await extractionsOf(doc.id)
    while (all.filter((e) => e.status === 'completed').length < 2) {
      if (Date.now() > deadline) throw new Error('The second run did not finish.')
      await new Promise((resolve) => setTimeout(resolve, 200))
      all = await extractionsOf(doc.id)
    }
    expect(all).toHaveLength(2)
    expect(all.every((e) => e.status === 'completed')).toBe(true)
  })

  it('fails a document on exhausted credit, without retrying', async () => {
    answer = () =>
      toServiceError(
        'stub',
        new APICallError({
          message: 'quota',
          url: 'https://vendor.example',
          requestBodyValues: {},
          statusCode: 429,
          responseBody: '{"error":{"code":"insufficient_quota"}}',
        }),
      )
    const doc = await upload(TEXT)
    expect(doc.status).toBe('failed')
    expect(doc.statusMessage).toMatch(/no credit left/)
    expect(requests).toHaveLength(1)
    const [extraction] = await extractionsOf(doc.id)
    expect(extraction?.status).toBe('failed')
  })

  it('reports exhausted credit on the health check as degraded', async () => {
    const openai = llmProviders.find((p) => p.id === 'openai')
    if (!openai) throw new Error('no openai')
    await payload.updateGlobal({
      slug: 'settings',
      data: { ai: { apiKey: 'sk-test' } } as never,
      overrideAccess: true,
    })
    configureAi({ llm: { adapter: openai, model: 'gpt-test' } })
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('api.openai.com')
        ? new Response('{"error":{"code":"insufficient_quota","message":"quota"}}', {
            status: 429,
            headers: { 'content-type': 'application/json' },
          })
        : realFetch(input, init)) as typeof fetch
    try {
      const health = await getHealth()
      expect(health.status).toBe('degraded')
      expect(health.services.ai).toMatchObject({
        healthy: false,
        error: 'external.credit-exhausted',
      })
    } finally {
      globalThis.fetch = realFetch
      configureAi({ llm: { adapter: stub, model: 'stub-model' } })
      await payload.updateGlobal({
        slug: 'settings',
        data: { ai: { apiKey: null } } as never,
        overrideAccess: true,
      })
    }
  })
})
