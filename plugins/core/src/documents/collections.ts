import { createHash } from 'node:crypto'

import { PromiseTrackerError } from '@promisetracker/kernel'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from '../access'
import { ADMIN_GROUPS } from '../adminGroups'
import { afterCommit } from '../afterCommit'
import { REGISTERED_LOCALES } from '../locales'
import { idOf } from '../places'
import { FILES } from './connectors'
import { checkFileType } from './fileType'
import { DOCUMENTS, PIPELINE_SAVE, PROCESSING_STATES, queueProcessing } from './pipeline'

/**
 * Source documents (section 7.8) and the files they hold. Neither is public:
 * claim pages link to documents as evidence, and only staff read them.
 */

/** Fields only the pipeline writes. A user's save never sets them. */
const PIPELINE_FIELDS = [
  'status',
  'statusMessage',
  'retryCount',
  'lastAttemptAt',
  'detectedType',
  'pageCount',
  'text',
] as const

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex')

/**
 * Checks an uploaded file before it is stored: its first bytes, declared type
 * and extension must agree, SVG is refused, and a file already stored is
 * pointed to rather than stored twice.
 */
const checkUpload: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  const file = req.file
  if (!file) {
    // The checksum belongs to the stored file, so only a new file changes it.
    const { checksum: _checksum, ...rest } = data
    return rest
  }
  let type: string
  try {
    type = checkFileType({ filename: file.name, declaredType: file.mimetype, data: file.data })
  } catch (error) {
    throw new APIError(error instanceof Error ? error.message : String(error), 400, null, true)
  }
  const checksum = sha256(file.data)
  const { docs } = await req.payload.find({
    collection: FILES as never,
    where: { checksum: { equals: checksum } },
    limit: 1,
    depth: 0,
    // A duplicate anywhere counts, whoever uploaded it.
    overrideAccess: true,
    req,
  })
  const existing = docs[0] as { id?: unknown; filename?: string } | undefined
  if (existing && idOf(existing) !== idOf(originalDoc)) {
    throw new APIError(
      `This file is already stored, as “${existing.filename ?? idOf(existing)}”. Choose it instead of uploading it again.`,
      400,
      null,
      true,
    )
  }
  return { ...data, checksum, mimeType: type }
}

/** The files documents hold. Each file is stored once, by checksum. */
export const DocumentFiles: CollectionConfig = {
  slug: FILES,
  labels: { singular: 'Source file', plural: 'Source files' },
  admin: {
    group: ADMIN_GROUPS.sources,
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'mimeType', 'credit', 'updatedAt'],
    description: 'Files behind documents. Each is stored once, and only staff can open them.',
  },
  access: {
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  // Replacing a file keeps the one before it in the history.
  versions: { maxPerDoc: 0 },
  upload: {
    // checkUpload checks every file more strictly than Payload's list of
    // restricted types, which would refuse HTML pages.
    allowRestrictedFileTypes: true,
    // The link connector is the only way the server fetches a link (section 13.4).
    pasteURL: false,
    // A stored page or file never runs in the admin's origin: it downloads, sandboxed.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Content-Security-Policy', "sandbox; default-src 'none'")
      headers.set('Content-Disposition', 'attachment')
      headers.set('X-Content-Type-Options', 'nosniff')
      return headers
    },
  },
  hooks: { beforeChange: [checkUpload] },
  fields: [
    {
      name: 'credit',
      type: 'text',
      admin: { description: 'Who made or published the file, if it should be credited.' },
    },
    {
      name: 'checksum',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'SHA-256 of the file, so it is stored once.' },
    },
  ],
}

const QUEUE = 'promisetracker:queueDocument'

type DocumentData = {
  connector?: string | null
  file?: unknown
  sourceUrl?: string | null
}

const changed = (a: unknown, b: unknown) => (idOf(a) ?? a ?? null) !== (idOf(b) ?? b ?? null)

/**
 * Starts processing when a document is added, and again when its file or
 * link changes. Anything else, such as a new title, leaves the status alone.
 */
const startProcessing: CollectionBeforeChangeHook = ({ data, originalDoc, operation, context }) => {
  if (context[PIPELINE_SAVE]) return data
  const own = Object.fromEntries(
    Object.entries(data).filter(([key]) => !(PIPELINE_FIELDS as readonly string[]).includes(key)),
  )
  const next = { ...(originalDoc as DocumentData | undefined), ...(own as DocumentData) }
  if (next.connector === 'upload' && !idOf(next.file)) {
    throw new APIError('Upload a file, or choose “Fetch a link” and paste one.', 400, null, true)
  }
  if (next.connector === 'url' && !next.sourceUrl && !idOf(next.file)) {
    throw new APIError('Paste the link to fetch.', 400, null, true)
  }
  const restart =
    operation === 'create' ||
    changed(next.file, originalDoc?.file) ||
    changed(next.connector, originalDoc?.connector) ||
    (next.connector === 'url' && changed(next.sourceUrl, originalDoc?.sourceUrl))
  if (!restart) return own
  context[QUEUE] = true
  return {
    ...own,
    // A new link is fetched again, so the file from the old one goes.
    ...(operation === 'update' && next.connector === 'url' && !changed(next.file, originalDoc?.file)
      ? { file: null }
      : {}),
    status: 'pending',
    statusMessage: null,
    retryCount: 0,
    detectedType: null,
    text: null,
    pageCount: null,
  }
}

/**
 * Queues the workflow once the save commits, and starts it without waiting,
 * so a small file is read at once. A worker would also pick it up, and the
 * document's concurrency key stops the two running together.
 */
const queueJob: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (!context[QUEUE]) return doc
  await afterCommit(req, async () => {
    const id = await queueProcessing(req.payload, String(doc.id))
    void req.payload.jobs.runByID({ id, overrideAccess: true }).catch((error: unknown) => {
      req.payload.logger.error({
        msg: 'Could not start processing a document',
        document: doc.id,
        err: error instanceof PromiseTrackerError ? error.message : error,
      })
    })
  })
  return doc
}

const STATE_LABELS: Record<(typeof PROCESSING_STATES)[number], string> = {
  pending: 'Waiting',
  fetching: 'Fetching',
  fetched: 'Fetched',
  extracting: 'Reading',
  extracted: 'Read',
  analysing: 'Finding claims',
  analysed: 'Claims found',
  imported: 'Imported',
  completed: 'Done',
  failed: 'Failed',
  'needs-review': 'Needs review',
}

/** Source material: a manifesto, a speech, a budget, a report (section 7.8). */
export const Documents: CollectionConfig = {
  slug: DOCUMENTS,
  labels: { singular: 'Document', plural: 'Documents' },
  admin: {
    group: ADMIN_GROUPS.sources,
    useAsTitle: 'title',
    defaultColumns: ['title', 'country', 'status', 'statusMessage', 'lastAttemptAt'],
    listSearchableFields: ['title', 'publisher'],
    description:
      'Upload a file or paste a link. The text is read in the background, and the status shows each step.',
  },
  access: {
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  hooks: { beforeChange: [startProcessing], afterChange: [queueJob] },
  // The work queue is read by status, oldest attempt first (section 7.10).
  indexes: [{ fields: ['status', 'lastAttemptAt'] }],
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'country',
          type: 'relationship',
          relationTo: 'countries',
          required: true,
          index: true,
        },
        {
          name: 'type',
          type: 'select',
          defaultValue: 'claims',
          options: [
            { label: 'A source of claims', value: 'claims' },
            { label: 'Evidence', value: 'evidence' },
          ],
          admin: { description: 'A manifesto or speech claims come from, or evidence about them.' },
        },
      ],
    },
    { name: 'actors', type: 'relationship', relationTo: 'actors', hasMany: true },
    {
      type: 'row',
      fields: [
        {
          name: 'language',
          type: 'select',
          options: REGISTERED_LOCALES.map((l) => ({ label: l.label, value: l.code })),
        },
        { name: 'publisher', type: 'text' },
        { name: 'date', type: 'date', admin: { date: { pickerAppearance: 'dayOnly' } } },
      ],
    },
    {
      name: 'connector',
      label: 'Bring it in by',
      type: 'radio',
      required: true,
      defaultValue: 'upload',
      options: [
        { label: 'Uploading a file', value: 'upload' },
        { label: 'Fetching a link', value: 'url' },
      ],
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: FILES as never,
      admin: {
        condition: (data) => data?.connector !== 'url' || Boolean(data?.file),
        description:
          'PDF, Word, Excel, PowerPoint, OpenDocument, RTF, EPUB, text, Markdown or HTML.',
      },
    },
    {
      name: 'sourceUrl',
      label: 'Link',
      type: 'text',
      validate: (value: unknown) => {
        if (!value) return true
        try {
          return new URL(String(value)).protocol === 'https:' || 'Use an https:// link.'
        } catch {
          return 'This is not a link.'
        }
      },
      admin: {
        description:
          'Where the document was published. With “Fetching a link”, the server fetches it once and stores the file. Otherwise it is only shown.',
      },
    },
    {
      type: 'collapsible',
      label: 'Processing',
      admin: { position: 'sidebar' },
      fields: [
        {
          name: 'status',
          type: 'select',
          defaultValue: 'pending',
          index: true,
          options: PROCESSING_STATES.map((value) => ({ label: STATE_LABELS[value], value })),
          admin: { readOnly: true },
        },
        {
          name: 'statusMessage',
          label: 'Message',
          type: 'textarea',
          admin: { readOnly: true, condition: (data) => Boolean(data?.statusMessage) },
        },
        {
          name: 'retryCount',
          label: 'Runs retried',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: 'lastAttemptAt',
          label: 'Last attempt',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'detectedType',
          label: 'File type',
          type: 'text',
          admin: { readOnly: true, condition: (data) => Boolean(data?.detectedType) },
        },
        {
          name: 'pageCount',
          label: 'Pages',
          type: 'number',
          admin: { readOnly: true, condition: (data) => typeof data?.pageCount === 'number' },
        },
      ],
    },
    {
      name: 'text',
      label: 'Text',
      type: 'textarea',
      admin: {
        readOnly: true,
        condition: (data) => Boolean(data?.text),
        description: 'Read from the file. Every character is kept.',
      },
    },
  ],
}
