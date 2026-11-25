import type { AdapterContext, LLMProvider } from '@promisetracker/kernel'
import { createLog, ExternalServiceError, TIMEOUTS } from '@promisetracker/kernel'
import { MAX_RUNS, outcomeOf, setStatus, tellUploader } from '@promisetracker/plugin-core'
import type { Payload, PayloadRequest } from 'payload'

import { extractCandidates, PROMPT_VERSION } from './extract'
import { selectModel } from './providers'

/**
 * The `extractCandidates` job (section 9.8). It runs once a source of claims
 * is read, and again when an editor asks. Its concurrency key is the AI
 * provider, so however many workers run, one document at a time is sent to
 * each provider (section 9.7).
 */

export const EXTRACT_TASK = 'extractCandidates'

type Ai = {
  llm: { adapter: LLMProvider; model: string } | null
  context: (payload: Payload, signal: AbortSignal) => Promise<AdapterContext>
}

let ai: Ai = {
  llm: null,
  context: async (payload, signal) => ({
    payload,
    logger: payload.logger,
    signal,
    settings: {},
  }),
}

/**
 * The model PT_LLM_MODEL chose and the context for its adapter, from the app.
 * Tests pass a stub provider here, so no real key is needed.
 */
export function configureAi(next: Partial<Ai>): void {
  ai = { ...ai, ...next }
  selectModel(ai.llm ? { vendor: ai.llm.adapter.id, model: ai.llm.model } : null)
}

export const configuredAi = () => ai

/** `provider:model`, as extractions record it. */
const modelName = (llm: NonNullable<Ai['llm']>) => `${llm.adapter.id}:${llm.model}`

type DocumentRow = {
  id: string
  title?: string | null
  type?: string | null
  status?: string | null
  text?: string | null
  retryCount?: number | null
  createdBy?: unknown
}

type Input = { documentId: string; again?: boolean | null }

const system = { overrideAccess: true, depth: 0 } as const

/** Queues the analysis of one document, now or later. */
export async function queueExtraction(
  payload: Payload,
  documentId: string,
  options: { again?: boolean; waitUntil?: Date } = {},
): Promise<string> {
  const job = await payload.jobs.queue({
    task: EXTRACT_TASK as never,
    input: { documentId, again: options.again ?? false } as never,
    // Queued by the system: whoever saved or asked was checked already.
    overrideAccess: true,
    ...(options.waitUntil ? { waitUntil: options.waitUntil } : {}),
  })
  return String((job as { id: unknown }).id)
}

/** Queues the analysis and starts it without waiting for a worker's next poll. */
export async function analyse(payload: Payload, documentId: string): Promise<void> {
  const id = await queueExtraction(payload, documentId)
  void payload.jobs.runByID({ id, overrideAccess: true }).catch((error: unknown) => {
    createLog(payload.logger, 'ai').error('Could not start an analysis', {
      ids: { document: documentId },
      error,
    })
  })
}

const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Runs AI over one document and saves the extraction (section 9.5). */
export async function runExtraction(payload: Payload, input: Input): Promise<void> {
  const log = createLog(payload.logger, 'ai')
  const ids = { document: input.documentId }
  const doc = (await payload
    .findByID({ collection: 'documents', id: input.documentId, ...system })
    .catch(() => null)) as DocumentRow | null
  if (!doc) return
  // A queued run for a document read again since, or already analysed, has nothing to do.
  // Running again on purpose goes ahead from any state that has text.
  const waiting = doc.status === 'extracted' || doc.status === 'analysing'
  if (!input.again && !waiting) return
  const text = doc.text ?? ''
  const { llm } = ai
  if (!llm) {
    await setStatus(payload, doc.id, 'failed', {
      statusMessage: 'No AI model is chosen. Set PT_LLM_MODEL and enable plugin-ai.',
    })
    return
  }
  await setStatus(payload, doc.id, 'analysing')
  const extraction = (await payload.create({
    collection: 'extractions' as never,
    data: {
      document: doc.id,
      model: modelName(llm),
      promptVersion: PROMPT_VERSION,
      status: 'running',
    } as never,
    ...system,
  })) as { id: string }
  const extractionIds = { ...ids, extraction: extraction.id }

  try {
    const outcome = await extractCandidates({
      title: doc.title ?? '',
      text,
      llm: llm.adapter,
      model: llm.model,
      context: (signal) => ai.context(payload, signal),
      // The whole AI stage of one document has 20 minutes (section 9.7).
      signal: AbortSignal.timeout(TIMEOUTS.aiStage),
      log,
      ids: extractionIds,
    })
    const candidates = outcome.candidates.map((c) => ({
      title: c.title,
      summary: c.summary,
      topic: c.topic,
      quotes: c.quotes,
      confidence: c.confidence,
      decision: 'pending',
    }))
    const message = outcome.notes.join(' ') || null
    await payload.update({
      collection: 'extractions' as never,
      id: extraction.id,
      data: {
        status: 'completed',
        message,
        sections: outcome.sections,
        inputTokens: outcome.usage.inputTokens,
        outputTokens: outcome.usage.outputTokens,
        candidates,
      } as never,
      ...system,
    })
    if (candidates.length === 0) {
      // Nothing usable: a person looks at the document (section 9.4).
      await setStatus(payload, doc.id, 'needs-review', {
        statusMessage:
          'AI found no claims whose quotes are in the text. Check the document, or add its claims by hand.',
        retryCount: 0,
      })
    } else {
      await setStatus(payload, doc.id, 'analysed', {
        statusMessage: `${candidates.length} candidate claims are waiting for review.${message ? ` ${message}` : ''}`,
        retryCount: 0,
      })
    }
    log.info('Extraction finished', {
      ids: extractionIds,
      candidates: candidates.length,
      inputTokens: outcome.usage.inputTokens,
      outputTokens: outcome.usage.outputTokens,
    })
  } catch (error) {
    const message = describe(error)
    await payload.update({
      collection: 'extractions' as never,
      id: extraction.id,
      data: { status: 'failed', message } as never,
      ...system,
    })
    const runs = (doc.retryCount ?? 0) + 1
    const outcome = outcomeOf(error, runs)
    if (outcome.retry) {
      // Back to waiting for analysis: the next run makes a new extraction.
      await setStatus(payload, doc.id, 'extracted', {
        retryCount: runs,
        statusMessage: `${message} Trying again in ${Math.ceil(outcome.waitMs / 1000)} seconds (run ${runs + 1} of ${MAX_RUNS}).`,
      })
      await queueExtraction(payload, doc.id, { waitUntil: new Date(Date.now() + outcome.waitMs) })
      log.warn('Extraction failed, running again later', { ids: extractionIds, error })
      return
    }
    await setStatus(payload, doc.id, 'failed', { retryCount: runs, statusMessage: message })
    const credit =
      error instanceof ExternalServiceError && error.code === 'external.credit-exhausted'
    log.error(credit ? 'The AI account has no credit left' : 'Extraction failed', {
      ids: extractionIds,
      error,
    })
    await tellUploader(payload, { ...doc, retryCount: runs } as never, message)
  }
}

export const extractCandidatesTask = {
  slug: EXTRACT_TASK,
  label: 'Find candidate claims with AI',
  inputSchema: [
    { name: 'documentId', type: 'text' as const, required: true },
    { name: 'again', type: 'checkbox' as const },
  ],
  // One document at a time per AI provider, whichever worker runs it.
  concurrency: {
    key: () => `ai:${ai.llm?.adapter.id ?? 'none'}`,
    exclusive: true,
  },
  // The run retries within itself, and decides about later runs (section 9.7).
  retries: 0,
  handler: async ({ input, req }: { input: Input; req: PayloadRequest }) => {
    await runExtraction(req.payload, input)
    return { output: {} }
  },
}
