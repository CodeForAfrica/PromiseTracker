import type { AdapterContext, LLMProvider, LLMResult, SourceLog } from '@promisetracker/kernel'
import {
  circuitBreakerFor,
  ExternalServiceError,
  TIMEOUTS,
  ValidationError,
  withRetry,
} from '@promisetracker/kernel'
import { findQuote } from '@promisetracker/plugin-core'
import { z } from 'zod'

import { serviceOf } from './providers'

/**
 * AI extraction (section 9.5), from v2's `src/tasks/extractPromises.ts`:
 *
 * 1. The text is split into overlapping sections. Each goes to the model,
 *    which returns candidates with a topic, a summary and exact quotes.
 * 2. Duplicates are removed, then every candidate whose quote is not in the
 *    document word for word is discarded.
 * 3. A second pass splits compound commitments and writes titles. The quote
 *    check runs again.
 */

/** Recorded on each extraction. Change it whenever the instructions or schemas change. */
export const PROMPT_VERSION = 'extract-v1'

/** About 3,500 tokens of text per section, as v2 had. */
export const SECTION_CHARS = 14_000
/** Enough overlap that a sentence cut at one section's end is whole in the next. */
export const SECTION_OVERLAP = 450
/** More sections than this is a document too long to analyse in 20 minutes. */
export const MAX_SECTIONS = 120
/** The second pass sees at most this many candidates, as in v2. */
export const MAX_SECOND_PASS = 220
/** A shorter quote matches too easily to prove anything. */
export const MIN_QUOTE_CHARS = 8

/** Splits text into overlapping sections, ending each at a paragraph or sentence where it can. */
export function sections(text: string): string[] {
  const source = text.trim()
  if (!source) return []
  if (source.length <= SECTION_CHARS) return [source]
  const result: string[] = []
  let start = 0
  while (start < source.length) {
    let end = Math.min(start + SECTION_CHARS, source.length)
    if (end < source.length) {
      const breakAt = Math.max(
        source.lastIndexOf('\n\n', end),
        source.lastIndexOf('. ', end),
        source.lastIndexOf('? ', end),
        source.lastIndexOf('! ', end),
        source.lastIndexOf('; ', end),
      )
      // A break too near the start would make the next section mostly overlap.
      if (breakAt > start + Math.floor(SECTION_CHARS * 0.55)) end = breakAt + 1
    }
    const part = source.slice(start, end).trim()
    if (part) result.push(part)
    if (end >= source.length) break
    start = Math.max(0, end - SECTION_OVERLAP)
  }
  return result
}

const squash = (value: string) => value.replace(/\s+/g, ' ').trim()
const keyOf = (value: string) =>
  squash(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Whether a quote is in the document word for word. Spacing and letter case
 * may differ, since extracted text breaks lines where the page did. Anything
 * else, a changed word or a paraphrase, fails. The review screen highlights
 * quotes with the same matching, so a quote that passes is always found.
 */
export function quoteChecker(text: string): (quote: string) => boolean {
  // Squashed once: a long document is checked against hundreds of quotes.
  const body = squash(text)
  return (quote) => {
    const cleaned = squash(quote)
    return cleaned.length >= MIN_QUOTE_CHARS && findQuote(body, cleaned, 0) !== null
  }
}

export const quoteAppears = (text: string, quote: string) => quoteChecker(text)(quote)

const confidence = z.number().min(0).max(1)

const firstPassItem = z.object({
  topic: z.string().min(1).describe('A short topic, such as Health or Housing'),
  summary: z.string().min(1).describe('One specific commitment, in one sentence'),
  quotes: z.array(z.string().min(1).describe('Words copied exactly from the section')).min(1),
  confidence: confidence.describe('How sure you are that this is a specific commitment, 0 to 1'),
})

const secondPassItem = firstPassItem.extend({
  title: z.string().min(1).describe('A short headline, such as "Build 200,000 homes a year"'),
})

const FIRST_PASS = z.object({ candidates: z.array(firstPassItem) })
const SECOND_PASS = z.object({ candidates: z.array(secondPassItem) })

export type FirstPassCandidate = z.infer<typeof firstPassItem>
export type Candidate = z.infer<typeof secondPassItem>

const schemaOf = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { target: 'draft-7' }) as Readonly<Record<string, unknown>>

const FIRST_PASS_SCHEMA = schemaOf(FIRST_PASS)
const SECOND_PASS_SCHEMA = schemaOf(SECOND_PASS)

export const FIRST_PASS_SYSTEM = `You find political commitments in one section of a document.

Rules:
- Return only specific commitments to do something that can be checked later.
- Never merge two commitments into one. If a sentence holds two, return two.
- Do not group commitments by theme.
- Each quote must be copied exactly from the section, word for word, in the section's own language.
- Write the topic and summary in the section's own language.
- Return an empty list when the section has no commitments.`

export const SECOND_PASS_SYSTEM = `You tidy a list of political commitments found in a document.

Rules:
- Split any item that holds more than one commitment into one item per commitment.
- Keep repeated mentions of the same commitment as one item, with all its quotes.
- Drop items that are opinions, values or descriptions rather than commitments.
- Give each item a short title.
- Keep every quote exactly as given. Never change, shorten or translate a quote.
- Write titles, topics and summaries in the language of the quotes.`

const firstPassPrompt = (section: string, index: number, total: number) =>
  `Section ${index + 1} of ${total}.\n\nFind every commitment in this section.\n\nSection text:\n${section}`

const secondPassPrompt = (title: string, candidates: readonly FirstPassCandidate[]) =>
  `Document: ${title}\n\nTidy these commitments:\n${JSON.stringify(candidates, null, 2)}`

/**
 * Removes duplicates and every quote not in the text, and then every
 * candidate left without a quote. Two candidates with the same summary and
 * topic are one, with the quotes of both.
 */
export function checkCandidates<T extends FirstPassCandidate>(
  candidates: readonly T[],
  text: string,
): T[] {
  const appears = quoteChecker(text)
  const merged = new Map<string, T>()
  for (const candidate of candidates) {
    const topic = squash(candidate.topic)
    const summary = squash(candidate.summary)
    if (!topic || !summary) continue
    const seen = new Set<string>()
    const quotes = candidate.quotes.map(squash).filter((quote) => {
      const key = quote.toLowerCase()
      if (seen.has(key) || !appears(quote)) return false
      seen.add(key)
      return true
    })
    if (quotes.length === 0) continue
    const key = `${keyOf(summary)}::${keyOf(topic)}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...candidate, topic, summary, quotes })
      continue
    }
    const known = new Set(existing.quotes.map((q) => q.toLowerCase()))
    existing.quotes = [...existing.quotes, ...quotes.filter((q) => !known.has(q.toLowerCase()))]
    existing.confidence = Math.max(existing.confidence, candidate.confidence)
  }
  return [...merged.values()]
}

export type ExtractionOutcome = {
  candidates: Candidate[]
  usage: { inputTokens: number; outputTokens: number }
  sections: number
  /** Sections the model's answer could not be used for. */
  failedSections: number
  /** Why the result may be incomplete, for the reviewer. */
  notes: string[]
}

export type ExtractionInput = {
  title: string
  text: string
  llm: LLMProvider
  model: string
  /** The context for the adapter, with the plugin's settings. */
  context: (signal: AbortSignal) => Promise<AdapterContext>
  signal: AbortSignal
  log?: SourceLog
  ids?: Readonly<Record<string, string>>
}

/** One call through the port, with section 9.7's retries, timeout and circuit breaker. */
async function call(
  input: ExtractionInput,
  operation: string,
  system: string,
  prompt: string,
  schema: Readonly<Record<string, unknown>>,
): Promise<LLMResult> {
  const service = serviceOf(input.llm.id)
  return withRetry(
    async (signal) =>
      input.llm.generate(
        { model: input.model, system, prompt, outputSchema: schema },
        await input.context(signal),
      ),
    {
      service,
      operation,
      signal: input.signal,
      timeoutMs: TIMEOUTS.aiCall,
      breaker: circuitBreakerFor(service),
      ...(input.ids ? { ids: input.ids } : {}),
      ...(input.log ? { log: input.log } : {}),
    },
  )
}

/** A section's answer that is not the shape asked for. */
const unusable = (error: unknown) =>
  error instanceof ExternalServiceError && error.failure === 'invalid-response'

/** Runs both passes over a document's text. Throws when no section could be read at all. */
export async function extractCandidates(input: ExtractionInput): Promise<ExtractionOutcome> {
  const all = sections(input.text)
  if (all.length === 0) throw new ValidationError('The document has no text to analyse.')
  const notes: string[] = []
  const used = all.slice(0, MAX_SECTIONS)
  if (all.length > MAX_SECTIONS) {
    notes.push(`Only the first ${MAX_SECTIONS} of ${all.length} sections were analysed.`)
  }
  const usage = { inputTokens: 0, outputTokens: 0 }
  const add = (result: LLMResult) => {
    usage.inputTokens += result.usage.inputTokens
    usage.outputTokens += result.usage.outputTokens
  }

  const found: FirstPassCandidate[] = []
  let failedSections = 0
  for (const [index, section] of used.entries()) {
    try {
      const result = await call(
        input,
        'find candidates',
        FIRST_PASS_SYSTEM,
        firstPassPrompt(section, index, used.length),
        FIRST_PASS_SCHEMA,
      )
      add(result)
      const parsed = FIRST_PASS.safeParse(result.output)
      if (!parsed.success) {
        failedSections += 1
        continue
      }
      found.push(...parsed.data.candidates)
    } catch (error) {
      // A model that answers in the wrong shape loses that section only.
      // Anything else, such as exhausted credit, stops the run.
      if (!unusable(error)) throw error
      failedSections += 1
    }
  }
  if (failedSections === used.length) {
    throw new ExternalServiceError(
      `The model's answer could not be used for any of the ${used.length} sections.`,
      { service: serviceOf(input.llm.id), failure: 'invalid-response' },
    )
  }
  if (failedSections > 0) {
    notes.push(
      `The model's answer could not be used for ${failedSections} of ${used.length} sections.`,
    )
  }

  const checked = checkCandidates(found, input.text)
  if (checked.length === 0) {
    return { candidates: [], usage, sections: used.length, failedSections, notes }
  }
  const forSecondPass = checked.slice(0, MAX_SECOND_PASS)
  if (checked.length > MAX_SECOND_PASS) {
    notes.push(`Only the first ${MAX_SECOND_PASS} of ${checked.length} candidates were tidied.`)
  }

  const result = await call(
    input,
    'split candidates',
    SECOND_PASS_SYSTEM,
    secondPassPrompt(input.title, forSecondPass),
    SECOND_PASS_SCHEMA,
  )
  add(result)
  const parsed = SECOND_PASS.safeParse(result.output)
  if (!parsed.success) {
    throw new ExternalServiceError("The model's second-pass answer is not the shape asked for.", {
      service: serviceOf(input.llm.id),
      failure: 'invalid-response',
    })
  }
  return {
    candidates: checkCandidates(parsed.data.candidates, input.text),
    usage,
    sections: used.length,
    failedSections,
    notes,
  }
}
