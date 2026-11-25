import { createHash } from 'node:crypto'

import type {
  AdapterContext,
  ContentExtractor,
  SourceConnector,
  SourceContent,
} from '@promisetracker/kernel'
import {
  circuitBreakerFor,
  createLog,
  ExternalServiceError,
  PromiseTrackerError,
  TIMEOUTS,
  ValidationError,
  withRetry,
} from '@promisetracker/kernel'
import type { Payload, PayloadRequest } from 'payload'

import { idOf } from '../places'
import { FILES, plaintextExtractor, uploadConnector, urlConnector } from './connectors'
import { checkFileType } from './fileType'

/**
 * The document pipeline (sections 9.2 to 9.4, 9.7 and 9.8). A document's
 * status is the work queue: each stage writes it before and after its work,
 * with any error message, so whoever uploaded the file can see what happened.
 *
 * The stages of one document run as one workflow, `processDocument`, so each
 * starts when the last ends. A concurrency key per document stops two workers
 * running the same one, and Payload's lease hands a dead worker's job to
 * another.
 */

export const DOCUMENTS = 'documents'

export const PROCESSING_STATES = [
  'pending',
  'fetching',
  'fetched',
  'extracting',
  'extracted',
  'analysing',
  'analysed',
  'imported',
  'completed',
  'failed',
  'needs-review',
] as const

export type ProcessingState = (typeof PROCESSING_STATES)[number]

/**
 * How many runs a document gets when a service stays down or asks to wait.
 * Each run retries within itself first (section 9.7).
 */
export const MAX_RUNS = 3

/** The wait before the next run when a service is down: one circuit-breaker window. */
export const NEXT_RUN_MS = 60_000

type Adapters = {
  connectors: readonly SourceConnector[]
  extractors: readonly ContentExtractor[]
  /** The context an adapter's methods get, with its plugin's settings. */
  context: (
    payload: Payload,
    adapter: { id: string },
    signal: AbortSignal,
  ) => Promise<AdapterContext>
  /**
   * What happens once a source of claims is read: plugin-ai queues its
   * analysis (section 9.8). None while no AI plugin is enabled, and the
   * document stays at `extracted`.
   */
  analyse: ((payload: Payload, documentId: string) => Promise<void>) | null
}

let adapters: Adapters = {
  connectors: [uploadConnector, urlConnector],
  extractors: [plaintextExtractor],
  context: async (payload, _adapter, signal) => ({
    payload,
    logger: payload.logger,
    signal,
    settings: {},
  }),
  analyse: null,
}

/** The connectors and extractors of every enabled plugin, chosen by the app (section 4.1). */
export function setPipelineAdapters(next: Partial<Adapters>): void {
  adapters = { ...adapters, ...next }
}

/**
 * The extractor for a type: one that names it exactly, else one that names
 * its family, such as `text/*`. The most specific match wins (section 4.1).
 */
export function extractorFor(
  extractors: readonly ContentExtractor[],
  type: string,
): ContentExtractor | null {
  const family = `${type.split('/')[0]}/*`
  return (
    extractors.find((e) => e.accepts.includes(type)) ??
    extractors.find((e) => e.accepts.includes(family)) ??
    null
  )
}

type DocumentRecord = {
  id: string
  title?: string | null
  /** A source of claims, or evidence about them. Only sources are analysed. */
  type?: string | null
  connector?: string | null
  file?: unknown
  sourceUrl?: string | null
  detectedType?: string | null
  status?: ProcessingState | null
  retryCount?: number | null
  createdBy?: unknown
}

/** Set on the pipeline's own saves, so they never queue more work. */
export const PIPELINE_SAVE = 'promisetracker:pipelineSave'

/** The pipeline runs as the system: whoever added the document was checked then. */
const system = { overrideAccess: true, depth: 0, context: { [PIPELINE_SAVE]: true } } as const

const load = async (payload: Payload, id: string): Promise<DocumentRecord> =>
  (await payload.findByID({ collection: DOCUMENTS as never, id, ...system })) as DocumentRecord

/** Writes a stage's status, with its message, and when it was tried. */
export async function setStatus(
  payload: Payload,
  id: string,
  status: ProcessingState,
  fields: Record<string, unknown> = {},
): Promise<void> {
  await payload.update({
    collection: DOCUMENTS as never,
    id,
    data: {
      status,
      statusMessage: null,
      lastAttemptAt: new Date().toISOString(),
      ...fields,
    } as never,
    ...system,
  })
}

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

/**
 * Stores a fetched file once: a file with the same checksum is reused rather
 * than stored again. Returns the file's record id.
 */
export async function storeFile(payload: Payload, content: SourceContent): Promise<string> {
  const checksum = sha256(content.data)
  const { docs } = await payload.find({
    collection: FILES as never,
    where: { checksum: { equals: checksum } },
    limit: 1,
    ...system,
  })
  const existing = idOf(docs[0])
  if (existing) return existing
  const created = await payload.create({
    collection: FILES as never,
    data: {} as never,
    file: {
      data: Buffer.from(content.data),
      mimetype: content.mimeType,
      name: content.filename,
      size: content.data.length,
    },
    ...system,
  })
  return String((created as { id: unknown }).id)
}

type StageResult = { ok: boolean }

/** Why a run stopped, for the document and for whether to run again. */
type Outcome = { retry: false } | { retry: true; waitMs: number }

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error ?? 'Unknown error')

/**
 * What to do after a stage fails, as section 9.7 says. Invalid data and a
 * rejected key fail at once. A service that stays down, or asks to wait
 * longer than a retry may, gets another run later, up to MAX_RUNS.
 */
export function outcomeOf(error: unknown, runsSoFar: number): Outcome {
  const retryable = error instanceof PromiseTrackerError ? error.retryable : false
  if (!retryable || runsSoFar >= MAX_RUNS) return { retry: false }
  const asked = error instanceof ExternalServiceError ? error.retryAfterMs : undefined
  return { retry: true, waitMs: asked ?? NEXT_RUN_MS * runsSoFar }
}

/** Ends a run that failed: run again later, or mark the document failed and tell the uploader. */
async function stageFailed(
  req: PayloadRequest,
  doc: DocumentRecord,
  stage: ProcessingState,
  error: unknown,
): Promise<StageResult> {
  const { payload } = req
  const log = createLog(payload.logger, 'documents')
  const runs = (doc.retryCount ?? 0) + 1
  const outcome = outcomeOf(error, runs)
  const message = describe(error)
  if (outcome.retry) {
    // Back in the queue: the status shows the wait, and the next run starts the stage again.
    await setStatus(payload, doc.id, 'pending', {
      retryCount: runs,
      statusMessage: `${message} Trying again in ${Math.ceil(outcome.waitMs / 1000)} seconds (run ${runs + 1} of ${MAX_RUNS}).`,
    })
    await queueProcessing(payload, doc.id, new Date(Date.now() + outcome.waitMs))
    log.warn(`${stage} failed, running again later`, { ids: { document: doc.id }, error })
    return { ok: false }
  }
  await setStatus(payload, doc.id, 'failed', { retryCount: runs, statusMessage: message })
  log.error(`${stage} failed`, { ids: { document: doc.id }, error })
  await tellUploader(payload, { ...doc, retryCount: runs }, message)
  return { ok: false }
}

/** Emails whoever added the document that it failed after every retry (section 9.4). */
export async function tellUploader(
  payload: Payload,
  doc: DocumentRecord,
  reason: string,
): Promise<void> {
  const log = createLog(payload.logger, 'documents')
  // Payload keeps who created a record as { relationTo, value }.
  const createdBy = doc.createdBy
  const uploader =
    createdBy && typeof createdBy === 'object' && 'value' in createdBy
      ? idOf(createdBy.value)
      : idOf(createdBy)
  const user = uploader
    ? await payload
        .findByID({ collection: 'users' as never, id: uploader, ...system })
        .catch(() => null)
    : null
  const to: unknown = user ? Reflect.get(user, 'email') : null
  const title = doc.title || 'A document'
  const subject = `“${title}” could not be processed`
  const link = `${payload.config.serverURL ?? ''}/admin/collections/${DOCUMENTS}/${doc.id}`
  const text = [
    `PromiseTracker could not process “${title}”.`,
    '',
    `Why: ${reason}`,
    '',
    'Fix the file or link and save the document to try again:',
    link,
  ].join('\n')
  // Until an email provider is chosen (D40), this line is how the message is seen.
  // The address stays out of it: logs never hold email addresses (section 13.7).
  log.info('Emailed the uploader that a document failed', {
    ids: { document: doc.id },
    subject,
    text,
    sent: typeof to === 'string',
  })
  if (typeof to !== 'string') return
  try {
    await payload.sendEmail({ to, subject, text })
  } catch (error) {
    log.error('Could not email the uploader', { ids: { document: doc.id }, error })
  }
}

const withContext = async <T>(
  payload: Payload,
  adapter: { id: string },
  signal: AbortSignal,
  work: (ctx: AdapterContext) => Promise<T>,
) => work(await adapters.context(payload, adapter, signal))

const connectorFor = (id: string | null | undefined): SourceConnector => {
  const connector = adapters.connectors.find((c) => c.id === id)
  if (!connector) throw new ValidationError(`No enabled plugin brings in documents by "${id}".`)
  return connector
}

/** The stored file's content, read back through the upload connector. */
async function storedContent(
  payload: Payload,
  doc: DocumentRecord,
  signal: AbortSignal,
): Promise<SourceContent> {
  const fileId = idOf(doc.file)
  if (!fileId) throw new ValidationError('The document has no file.')
  return withContext(payload, uploadConnector, signal, (ctx) =>
    uploadConnector.fetch({ id: fileId }, ctx),
  )
}

/**
 * The `fetchDocument` stage: brings the file in. A link is fetched once, and
 * the file stored. An uploaded file is read back. Either way its type is
 * checked from its first bytes, its declared type and its extension.
 */
async function fetchStage(
  req: PayloadRequest,
  id: string,
  signal: AbortSignal,
): Promise<StageResult> {
  const { payload } = req
  const doc = await load(payload, id)
  if (doc.status !== 'pending' && doc.status !== 'fetching') return { ok: doc.status !== 'failed' }
  await setStatus(payload, id, 'fetching')
  const log = createLog(payload.logger, 'documents')
  try {
    const connector = connectorFor(doc.connector)
    let fileId = idOf(doc.file)
    let detectedType: string
    let sourceUrl = doc.sourceUrl ?? null
    if (connector.id !== uploadConnector.id && !fileId) {
      const link = doc.sourceUrl
      if (!link) throw new ValidationError('Add the link to fetch.')
      const host = (() => {
        try {
          return new URL(link).host
        } catch {
          return 'invalid'
        }
      })()
      const content = await withRetry(
        (attemptSignal) =>
          withContext(payload, connector, attemptSignal, (ctx) =>
            connector.fetch({ id: link }, ctx),
          ),
        {
          service: connector.id,
          operation: 'fetch document',
          ids: { document: id },
          signal,
          timeoutMs: TIMEOUTS.fetchFile,
          breaker: circuitBreakerFor(`${connector.id}:${host}`),
          log,
        },
      )
      detectedType = checkFileType({
        filename: content.filename,
        declaredType: content.mimeType,
        data: content.data,
      })
      fileId = await storeFile(payload, { ...content, mimeType: detectedType })
      sourceUrl = content.sourceUrl ?? sourceUrl
    } else {
      const content = await storedContent(payload, doc, signal)
      detectedType = checkFileType({
        filename: content.filename,
        declaredType: content.mimeType,
        data: content.data,
      })
    }
    await setStatus(payload, id, 'fetched', { file: fileId, detectedType, sourceUrl })
    return { ok: true }
  } catch (error) {
    return stageFailed(req, doc, 'fetching', error)
  }
}

/** The `extractText` stage: reads the file into text with the extractor for its type. */
async function extractStage(
  req: PayloadRequest,
  id: string,
  signal: AbortSignal,
): Promise<StageResult> {
  const { payload } = req
  const doc = await load(payload, id)
  if (doc.status !== 'fetched' && doc.status !== 'extracting') return { ok: false }
  await setStatus(payload, id, 'extracting')
  const log = createLog(payload.logger, 'documents')
  try {
    const type = doc.detectedType ?? ''
    const extractor = extractorFor(adapters.extractors, type)
    if (!extractor) {
      throw new ValidationError(
        `No enabled plugin reads ${type} files. plugin-tika reads PDF, Word, Excel and more.`,
      )
    }
    const content = { ...(await storedContent(payload, doc, signal)), mimeType: type }
    const result = await withRetry(
      (attemptSignal) =>
        withContext(payload, extractor, attemptSignal, (ctx) => extractor.extract(content, ctx)),
      {
        service: extractor.id,
        operation: 'extract text',
        ids: { document: id },
        signal,
        timeoutMs: TIMEOUTS.extractText,
        breaker: circuitBreakerFor(extractor.id),
        log,
      },
    )
    // The extractor's own text, kept whole: only the line ends and form are standardised.
    const text = result.text.normalize('NFC')
    if (!text.trim()) throw new ValidationError('The file has no text to read.')
    await setStatus(payload, id, 'extracted', {
      text,
      pageCount: result.pageCount,
      retryCount: 0,
    })
  } catch (error) {
    return stageFailed(req, doc, 'extracting', error)
  }
  // After the text is saved: a failure to queue the analysis is not a failure to read.
  if (adapters.analyse && (doc.type ?? 'claims') === 'claims') {
    await adapters.analyse(payload, id).catch((error: unknown) => {
      log.error('Could not queue the analysis', { ids: { document: id }, error })
    })
  }
  return { ok: true }
}

type DocumentInput = { documentId: string }

const handler =
  (stage: typeof fetchStage) =>
  async ({ input, req }: { input: DocumentInput; req: PayloadRequest }) => ({
    output: await stage(req, input.documentId, new AbortController().signal),
  })

export const fetchDocumentTask = {
  slug: 'fetchDocument',
  label: 'Fetch a document',
  inputSchema: [{ name: 'documentId', type: 'text' as const, required: true }],
  outputSchema: [{ name: 'ok', type: 'checkbox' as const }],
  // Each stage retries within itself and decides about later runs (section 9.7).
  retries: 0,
  handler: handler(fetchStage),
}

export const extractTextTask = {
  slug: 'extractText',
  label: 'Read a document into text',
  inputSchema: [{ name: 'documentId', type: 'text' as const, required: true }],
  outputSchema: [{ name: 'ok', type: 'checkbox' as const }],
  retries: 0,
  handler: handler(extractStage),
}

type Tasks = Record<
  'fetchDocument' | 'extractText',
  (id: string, args: { input: DocumentInput }) => Promise<StageResult>
>

/**
 * One document's stages as one workflow (section 9.8). Analysis, the next
 * stage, belongs to plugin-ai. It runs as its own job, queued once the text
 * is read, because its concurrency key is the AI provider, not the document.
 */
export const processDocumentWorkflow = {
  slug: 'processDocument',
  label: 'Process a document',
  inputSchema: [{ name: 'documentId', type: 'text' as const, required: true }],
  // Never two runs of one document at once. A newer run replaces one still waiting.
  concurrency: {
    key: ({ input }: { input: DocumentInput }) => `document:${input.documentId}`,
    exclusive: true,
    supersedes: true,
  },
  retries: 0,
  handler: async ({ job, tasks }: { job: { input: DocumentInput }; tasks: unknown }) => {
    const run = tasks as Tasks
    const input = { documentId: job.input.documentId }
    const fetched = await run.fetchDocument('fetch', { input })
    if (!fetched.ok) return
    await run.extractText('extract', { input })
  },
}

/** Queues a document's workflow, now or at a later time. */
export async function queueProcessing(
  payload: Payload,
  documentId: string,
  waitUntil?: Date,
): Promise<string> {
  // Queued by the system: whoever saved the document was checked by its access rules.
  const job = await payload.jobs.queue({
    workflow: processDocumentWorkflow.slug as never,
    input: { documentId } as never,
    overrideAccess: true,
    ...(waitUntil ? { waitUntil } : {}),
  })
  return String((job as { id: unknown }).id)
}

/** Finished jobs go at once, failed ones after this long (section 13.9). */
export const FAILED_JOB_DAYS = 7

/** Removes finished jobs, and failed ones after 7 days (sections 9.8 and 13.9). */
export async function cleanupJobs(
  payload: Payload,
  now = new Date(),
): Promise<{ removed: number }> {
  const cutoff = new Date(now.getTime() - FAILED_JOB_DAYS * 24 * 60 * 60_000).toISOString()
  const { docs } = await payload.delete({
    collection: 'payload-jobs' as never,
    where: {
      // A job that has neither finished nor failed is waiting or running, and stays.
      or: [
        { and: [{ completedAt: { exists: true } }, { hasError: { not_equals: true } }] },
        { and: [{ hasError: { equals: true } }, { updatedAt: { less_than: cutoff } }] },
      ],
    },
    overrideAccess: true,
  })
  return { removed: docs.length }
}

export const cleanupJobsTask = {
  slug: 'cleanupJobs',
  label: 'Remove old jobs',
  retries: 0,
  // Hourly, on the hour. Payload's cron has a seconds field first.
  schedule: [{ cron: '0 0 * * * *', queue: 'default' }],
  handler: async ({ req }: { req: PayloadRequest }) => {
    const { removed } = await cleanupJobs(req.payload)
    createLog(req.payload.logger, 'jobs').info('Removed old jobs', { removed })
    return { output: {} }
  },
}
