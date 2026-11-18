import type { ImportRow, SourceContent, StructuredImporter } from '@promisetracker/kernel'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  Payload,
  PayloadRequest,
} from 'payload'
import { APIError } from 'payload'

import type { Permission } from '../access'
import { can, signedIn, userCan } from '../access'
import { ADMIN_GROUPS } from '../adminGroups'
import { afterCommit } from '../afterCommit'
import type { ImportResult } from './engine'
import { runImportPlan } from './engine'
import { csvImporter, xlsxImporter } from './readers'
import type { ImportTarget } from './targets'
import { ALL_MAPPING_KEYS, guessMapping, IMPORT_TARGETS, mappingKeys } from './targets'

/** Who may import each kind of record: whoever may create it (section 13.2). */
const PERMISSION: Record<ImportTarget, Permission> = {
  areas: 'manageStructure',
  offices: 'manageStructure',
  actors: 'editRecords',
  terms: 'editRecords',
}

let importers: readonly StructuredImporter[] = [csvImporter, xlsxImporter]

/** The readers an import can use: every enabled plugin's, chosen by the app. */
export function setImporters(next: readonly StructuredImporter[]): void {
  importers = next
}

const isTarget = (value: unknown): value is ImportTarget => IMPORT_TARGETS.some((t) => t === value)

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id: unknown = Reflect.get(value, 'id')
    return typeof id === 'string' ? id : null
  }
  return null
}

type MappingRow = { field: string; column: string }
const toRecord = (rows: unknown): Record<string, string> =>
  Object.fromEntries(
    (Array.isArray(rows) ? (rows as MappingRow[]) : [])
      .filter((r) => r?.field && r?.column)
      .map((r) => [r.field, r.column]),
  )
const toRows = (mapping: Record<string, string>): MappingRow[] =>
  Object.entries(mapping).map(([field, column]) => ({ field, column }))

/** A saved mapping whose columns all appear in these headings, the newest first. */
async function savedMapping(
  payload: Payload,
  target: ImportTarget,
  headings: readonly string[],
): Promise<Record<string, string> | null> {
  const { docs } = await payload.find({
    collection: 'import-mappings',
    where: { recordType: { equals: target } },
    sort: '-updatedAt',
    depth: 0,
    pagination: false,
    // Saved mappings are shared by everyone who imports.
    overrideAccess: true,
  })
  for (const doc of docs) {
    const columns =
      doc.columns && typeof doc.columns === 'object' ? (doc.columns as Record<string, string>) : {}
    const values = Object.values(columns)
    if (values.length > 0 && values.every((c) => headings.includes(c))) return columns
  }
  return null
}

const QUEUE = 'promisetracker:queueImport'

/**
 * The steps of an import (section 9.6). Uploading a file reads it and guesses
 * the mapping. "Preview" works out what would change, saving nothing.
 * "Import" queues the job that saves.
 */
const runSteps: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
  context,
}) => {
  const target = data.recordType ?? originalDoc?.recordType
  if (!isTarget(target)) throw new APIError('Choose what the file holds.', 400)
  // A signed-in user needs the right to create these records. Without a user it is
  // the system, through the Local API: guests cannot reach here, since creating an
  // import needs a staff role.
  if (req.user && !userCan(req.user, PERMISSION[target])) {
    throw new APIError(`You cannot import ${target}.`, 403)
  }

  if (operation === 'create') {
    const file = req.file
    if (!file) throw new APIError('Upload a CSV or Excel file.', 400)
    const reader = importers.find((i) => i.accepts.includes(file.mimetype))
    if (!reader) throw new APIError('This kind of file cannot be imported. Use CSV or Excel.', 400)
    const content: SourceContent = { filename: file.name, mimeType: file.mimetype, data: file.data }
    // The core readers need no context, and plugin readers get the kernel's through setImporters.
    const ctx = {} as Parameters<StructuredImporter['inspect']>[1]
    try {
      const { headings, sampleRows } = await reader.inspect(content, ctx)
      const rows: ImportRow[] = []
      for await (const row of reader.rows(content, ctx)) rows.push(row)
      const mapping =
        (await savedMapping(req.payload, target, headings)) ?? guessMapping(target, headings)
      return {
        ...data,
        headings,
        sampleRows,
        rows,
        mapping: toRows(mapping),
        status: 'mapping',
        nextStep: null,
      }
    } catch (error) {
      throw new APIError(
        `The file could not be read: ${error instanceof Error ? error.message : error}`,
        400,
      )
    }
  }

  const step = data.nextStep
  if (!step) return data
  const headings: string[] = data.headings ?? originalDoc?.headings ?? []
  const rows: ImportRow[] = data.rows ?? originalDoc?.rows ?? []
  const mapping = toRecord(data.mapping ?? originalDoc?.mapping)
  const missing = Object.entries(mapping).filter(([, column]) => !headings.includes(column))
  if (missing.length > 0) {
    throw new APIError(
      `These columns are not in the file: ${missing.map(([, c]) => c).join(', ')}.`,
      400,
    )
  }
  const country = idOf(data.country ?? originalDoc?.country)
  if (!country) throw new APIError('Choose a country.', 400)
  if (step === 'preview') {
    const { counts, errors } = await runImportPlan(req.payload, {
      target,
      country,
      headings,
      rows,
      mapping,
      commit: false,
    })
    return { ...data, preview: counts, errors, status: 'previewed', nextStep: null }
  }
  if (originalDoc?.status === 'queued' || originalDoc?.status === 'running') {
    throw new APIError('This import is already running.', 400)
  }
  context[QUEUE] = true
  return { ...data, status: 'queued', nextStep: null }
}

/** Queues the import's job once the save commits, and starts it at once. */
const queueJob: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (!context[QUEUE]) return doc
  await afterCommit(req, async () => {
    // Who asked for the import was checked in runSteps, so the job is queued as the system.
    const job = await req.payload.jobs.queue({
      task: 'runImport',
      input: { importId: doc.id },
      overrideAccess: true,
    })
    // A worker would also pick it up. Running it here means a small import is done
    // without waiting for the next poll, and Payload's lease stops it running twice.
    await req.payload.jobs.runByID({ id: job.id, overrideAccess: true })
  })
  return doc
}

const readOnly = { readOnly: true } as const
/** Shown once the import exists: an upload has nothing to show before it is read. */
const once = (data: { id?: unknown } | undefined) => Boolean(data?.id)
/** A group of counts, shown once a step has filled it in. */
const counted = (group: unknown) =>
  Boolean(group) &&
  typeof group === 'object' &&
  typeof Reflect.get(group as object, 'failed') === 'number'

/** An import of areas, offices, actors or terms from a spreadsheet (section 9.6). */
export const Imports: CollectionConfig = {
  slug: 'imports',
  labels: { singular: 'Import', plural: 'Imports' },
  admin: {
    group: ADMIN_GROUPS.imports,
    useAsTitle: 'filename',
    defaultColumns: ['filename', 'recordType', 'country', 'status', 'updatedAt'],
    description:
      'Upload a CSV or Excel file. Check the mapping, then choose Preview, and Import when the preview is right.',
  },
  upload: {
    mimeTypes: [
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },
  access: {
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  hooks: { beforeChange: [runSteps], afterChange: [queueJob] },
  fields: [
    { name: 'country', type: 'relationship', relationTo: 'countries', required: true },
    {
      name: 'recordType',
      label: 'The file holds',
      type: 'select',
      required: true,
      options: IMPORT_TARGETS.map((value) => ({ label: value, value })),
    },
    {
      name: 'nextStep',
      type: 'select',
      options: [
        { label: 'Preview', value: 'preview' },
        { label: 'Import', value: 'import' },
      ],
      admin: {
        condition: (data) => Boolean(data?.id),
        description: 'Runs when you save.',
      },
    },
    {
      name: 'mapping',
      type: 'array',
      admin: {
        condition: (data) => Boolean(data?.id),
        description:
          'Which column fills each field. Guessed from the headings, or from a saved mapping.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'field',
              type: 'select',
              required: true,
              options: ALL_MAPPING_KEYS.map((value) => ({ label: value, value })),
            },
            { name: 'column', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'saveMappingAs',
      type: 'text',
      admin: {
        condition: (data) => Boolean(data?.id),
        description: 'Give the mapping a name to keep it for the next file with these headings.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'mapping',
      options: ['mapping', 'previewed', 'queued', 'running', 'done', 'failed'].map((value) => ({
        label: value,
        value,
      })),
      admin: { position: 'sidebar', condition: once, ...readOnly },
    },
    {
      name: 'preview',
      type: 'group',
      admin: { condition: (data) => counted(data?.preview), ...readOnly },
      fields: ['create', 'update', 'skip', 'failed'].map((name) => ({
        name,
        type: 'number' as const,
      })),
    },
    {
      name: 'result',
      type: 'group',
      admin: { condition: (data) => counted(data?.result), ...readOnly },
      fields: ['create', 'update', 'skip', 'failed'].map((name) => ({
        name,
        type: 'number' as const,
      })),
    },
    {
      name: 'errors',
      type: 'json',
      admin: {
        description: 'Problems by spreadsheet row, headings being row 1.',
        condition: (data) => Array.isArray(data?.errors) && data.errors.length > 0,
        ...readOnly,
      },
    },
    { name: 'headings', type: 'json', admin: { condition: once, ...readOnly } },
    { name: 'sampleRows', type: 'json', admin: { condition: once, ...readOnly } },
    // Every row of the file, read once on upload, so later steps need not read the file again.
    { name: 'rows', type: 'json', admin: { hidden: true } },
  ],
}

/** Mappings kept for reuse (section 9.6, D49). */
export const ImportMappings: CollectionConfig = {
  slug: 'import-mappings',
  labels: { singular: 'Saved mapping', plural: 'Saved mappings' },
  admin: { group: ADMIN_GROUPS.imports, useAsTitle: 'name' },
  access: {
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'recordType',
      type: 'select',
      required: true,
      options: IMPORT_TARGETS.map((value) => ({ label: value, value })),
    },
    {
      name: 'columns',
      type: 'json',
      required: true,
      admin: { description: 'Field to column heading.' },
    },
  ],
}

/** The job that saves an import's rows (section 9.8). */
export const runImportTask = {
  slug: 'runImport',
  inputSchema: [{ name: 'importId', type: 'text' as const, required: true }],
  retries: 0,
  handler: async ({ input, req }: { input: { importId: string }; req: PayloadRequest }) => {
    const { payload } = req
    // The job runs as the system. Who asked for the import was checked when it was queued.
    const doc = await payload.findByID({
      collection: 'imports',
      id: input.importId,
      overrideAccess: true,
    })
    const target = doc.recordType
    const country = idOf(doc.country)
    let result: ImportResult | null = null
    try {
      await payload.update({
        collection: 'imports',
        id: doc.id,
        data: { status: 'running' },
        overrideAccess: true,
      })
      if (!isTarget(target) || !country)
        throw new Error('The import has no record type or country.')
      const mapping = toRecord(doc.mapping)
      result = await runImportPlan(payload, {
        target,
        country,
        headings: (doc.headings as string[]) ?? [],
        rows: (doc.rows as ImportRow[]) ?? [],
        mapping,
        commit: true,
      })
      if (doc.saveMappingAs) {
        const { docs } = await payload.find({
          collection: 'import-mappings',
          where: {
            and: [{ name: { equals: doc.saveMappingAs } }, { recordType: { equals: target } }],
          },
          limit: 1,
          overrideAccess: true,
        })
        const [existing] = docs
        const data = { name: doc.saveMappingAs, recordType: target, columns: mapping }
        if (existing) {
          await payload.update({
            collection: 'import-mappings',
            id: existing.id,
            data,
            overrideAccess: true,
          })
        } else {
          await payload.create({ collection: 'import-mappings', data, overrideAccess: true })
        }
      }
      await payload.update({
        collection: 'imports',
        id: doc.id,
        data: { status: 'done', result: result.counts, errors: result.errors },
        overrideAccess: true,
      })
    } catch (error) {
      await payload.update({
        collection: 'imports',
        id: doc.id,
        data: {
          status: 'failed',
          errors: [
            ...(result?.errors ?? []),
            { line: 0, message: error instanceof Error ? error.message : String(error) },
          ],
        },
        overrideAccess: true,
      })
    }
    return { output: {} }
  },
}

export { mappingKeys }
