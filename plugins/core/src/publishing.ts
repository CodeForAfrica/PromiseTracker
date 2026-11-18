import type { CollectionConfig, Field, FieldHook, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'

import type { RecordStatus } from './access'
import { maySetRecordStatus, signedIn } from './access'

/**
 * Publishing rules, the part every public record type shares (section 8.1).
 *
 * `recordStatus` is what an editor wants. `publishedIn` is what the system
 * works out: the languages the record is live in. The public site asks one
 * question of every list, "is this published in this language?", through
 * `publishedInLocale`. Parents and the cascade arrive with #649 and build on
 * this.
 */

export const RECORD_STATUSES = [
  'ready',
  'hold',
  'archived',
] as const satisfies readonly RecordStatus[]

/** A localized field's value in every language, as Payload returns it with `locale: 'all'`. */
type PerLocale = Readonly<Record<string, unknown>>

const isFilled = (value: unknown): boolean =>
  typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined

/**
 * The languages a record is published in: none unless it is ready, then each
 * language in which every required localized field has a value.
 */
export function computePublishedIn(
  status: unknown,
  required: Readonly<Record<string, PerLocale>>,
  locales: readonly string[],
): string[] {
  if (status !== 'ready') return []
  const fields = Object.values(required)
  return locales.filter((locale) => fields.every((values) => isFilled(values[locale])))
}

/** Records published in this language. Every public query uses it. */
export const publishedInLocale = (locale: string): Where => ({
  publishedIn: { in: [locale] },
})

/** Staff read everything. A guest reads only records an editor has marked ready. */
export const readReadyOrStaff = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || { recordStatus: { equals: 'ready' } }

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** Refuses a status the user may not set. A contributor may only hold (section 13.2). */
const checkStatus: FieldHook = ({ value, previousValue, req }) => {
  if (req.user && value !== previousValue && typeof value === 'string') {
    if (!maySetRecordStatus(req.user, value as RecordStatus)) {
      throw new APIError(`You cannot set this record to ${value}.`, 403)
    }
  }
  return value
}

const statusFields = (): Field[] => [
  {
    name: 'recordStatus',
    type: 'select',
    required: true,
    defaultValue: 'hold',
    options: RECORD_STATUSES.map((value) => ({ label: value, value })),
    index: true,
    admin: {
      position: 'sidebar',
      description: 'Ready makes it public in each language that has its required fields.',
    },
    hooks: { beforeChange: [checkStatus] },
  },
  {
    name: 'publishedIn',
    type: 'text',
    hasMany: true,
    index: true,
    admin: {
      position: 'sidebar',
      readOnly: true,
      description: 'Worked out on save. The languages this record is live in.',
    },
    // Only the hook below writes it.
    access: { create: () => false, update: () => false },
  },
]

/**
 * Adds the record status and the computed published status to a record type.
 * `required` names the localized fields that must have a value in a language
 * for the record to be live in it.
 */
export function withPublishing(
  collection: CollectionConfig,
  required: readonly string[],
): CollectionConfig {
  const computeOnSave: NonNullable<NonNullable<CollectionConfig['hooks']>['beforeChange']>[number] =
    async ({ data, originalDoc, operation, req }) => {
      const locales = req.payload.config.localization
        ? req.payload.config.localization.localeCodes
        : []
      const editing = req.locale
      // The values saved before, in every language. A save carries only the
      // language being edited, so the others come from the database. The read
      // does not share this request: reading every language through it would
      // switch the save itself to every language, and drop the new value.
      const stored =
        operation === 'update' && originalDoc?.id
          ? asRecord(
              await req.payload.findByID({
                collection: collection.slug as never,
                id: originalDoc.id,
                locale: 'all',
                depth: 0,
                // Reads the record being saved, to work out where it is live.
                overrideAccess: true,
              }),
            )
          : {}
      const values: Record<string, PerLocale> = {}
      for (const name of required) {
        const before = asRecord(stored[name])
        const incoming = data[name]
        values[name] =
          incoming && typeof incoming === 'object'
            ? { ...before, ...asRecord(incoming) }
            : name in data && editing
              ? { ...before, [editing]: incoming }
              : before
      }
      const status = data.recordStatus ?? originalDoc?.recordStatus ?? 'hold'
      return { ...data, publishedIn: computePublishedIn(status, values, locales) }
    }

  return {
    ...collection,
    fields: [...collection.fields, ...statusFields()],
    hooks: {
      ...collection.hooks,
      beforeChange: [...(collection.hooks?.beforeChange ?? []), computeOnSave],
    },
  }
}
