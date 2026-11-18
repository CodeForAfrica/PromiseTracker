import type { Payload } from 'payload'

import { REGISTERED_LOCALES } from '../locales'
import { AREA_PAGE, AREA_TYPES } from '../places'
import { slugify } from '../slugs'

/** What an import can create or update (section 9.6). Others join with their issues. */
export const IMPORT_TARGETS = ['areas', 'offices'] as const
export type ImportTarget = (typeof IMPORT_TARGETS)[number]

/** A field a column can fill. A localized field also has one per language, as `name:fr`. */
export type TargetField = {
  key: string
  label: string
  required?: boolean
  localized?: boolean
  /** The values a column may hold, matched without regard to case. */
  options?: readonly string[]
  number?: boolean
}

const FIELDS: Record<ImportTarget, readonly TargetField[]> = {
  areas: [
    { key: 'name', label: 'Name', required: true, localized: true },
    { key: 'slug', label: 'Slug' },
    { key: 'type', label: 'Type', required: true, options: AREA_TYPES },
    { key: 'parent', label: 'Parent' },
    { key: 'page', label: 'Page', options: AREA_PAGE },
    { key: 'externalCode', label: 'Code' },
  ],
  offices: [
    { key: 'name', label: 'Name', required: true, localized: true },
    { key: 'shortName', label: 'Short name', localized: true },
    { key: 'slug', label: 'Slug' },
    { key: 'areaType', label: 'Area type', options: AREA_TYPES },
    { key: 'holdersPerSeat', label: 'Holders per seat', number: true },
    { key: 'order', label: 'Order', number: true },
  ],
}

const OTHER_LOCALES = REGISTERED_LOCALES.slice(1).map((l) => l.code)

/**
 * Every key a mapping may use for a target: each field, and each localized
 * field in every language but the default, such as `name:fr`.
 */
export function mappingKeys(target: ImportTarget): { key: string; label: string }[] {
  return FIELDS[target].flatMap((field) => [
    { key: field.key, label: field.label },
    ...(field.localized
      ? OTHER_LOCALES.map((locale) => ({
          key: `${field.key}:${locale}`,
          label: `${field.label} (${locale})`,
        }))
      : []),
  ])
}

export const ALL_MAPPING_KEYS = [
  ...new Set(IMPORT_TARGETS.flatMap((t) => mappingKeys(t).map((k) => k.key))),
]

const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** A mapping guessed from the headings: a column named like a field fills it. */
export function guessMapping(
  target: ImportTarget,
  headings: readonly string[],
): Record<string, string> {
  const byName = new Map(headings.map((h) => [normalize(h), h]))
  const mapping: Record<string, string> = {}
  for (const { key, label } of mappingKeys(target)) {
    const heading = byName.get(normalize(key)) ?? byName.get(normalize(label))
    if (heading) mapping[key] = heading
  }
  return mapping
}

/** One row turned into a record, or the reasons it cannot be. */
export type PlannedRow = {
  line: number
  slug: string
  /** Values in the default language, and the non-localized fields. */
  data: Record<string, unknown>
  /** Localized values in the other languages. */
  translations: Record<string, Record<string, string>>
  /** The parent's slug, for areas. */
  parent: string | null
  errors: string[]
}

/** Reads a row through the mapping, checking each value (section 9.6). */
export function planRow(
  target: ImportTarget,
  headings: readonly string[],
  mapping: Readonly<Record<string, string>>,
  values: readonly string[],
  line: number,
): PlannedRow {
  const cell = (key: string): string => {
    const heading = mapping[key]
    const column = heading === undefined ? -1 : headings.indexOf(heading)
    return column >= 0 ? (values[column] ?? '').trim() : ''
  }
  const errors: string[] = []
  const data: Record<string, unknown> = {}
  const translations: PlannedRow['translations'] = {}
  for (const field of FIELDS[target]) {
    if (field.key === 'slug' || field.key === 'parent') continue
    const raw = cell(field.key)
    if (!raw) {
      if (field.required) errors.push(`${field.label} is empty.`)
    } else if (field.options) {
      const match = field.options.find((o) => o === raw.toLowerCase())
      if (match) data[field.key] = match
      else errors.push(`${field.label} "${raw}" is not one of ${field.options.join(', ')}.`)
    } else if (field.number) {
      const n = Number(raw)
      if (Number.isInteger(n) && n >= 0) data[field.key] = n
      else errors.push(`${field.label} "${raw}" is not a whole number.`)
    } else {
      data[field.key] = raw
    }
    if (field.localized) {
      for (const locale of OTHER_LOCALES) {
        const translated = cell(`${field.key}:${locale}`)
        if (translated) {
          translations[locale] = { ...translations[locale], [field.key]: translated }
        }
      }
    }
  }
  const name = typeof data.name === 'string' ? data.name : ''
  const slug = cell('slug') || slugify(name)
  if (!slug && name) errors.push('The slug cannot be made from the name. Add a slug column.')
  const parent = target === 'areas' ? cell('parent') || null : null
  return { line, slug, data, translations, parent: parent ? slugify(parent) : null, errors }
}

/** The records of a target in one country, by slug, in every language. */
export async function existingBySlug(
  payload: Payload,
  target: ImportTarget,
  country: string,
): Promise<Map<string, Record<string, unknown>>> {
  const { docs } = await payload.find({
    collection: target,
    where: { country: { equals: country } },
    locale: 'all',
    depth: 0,
    pagination: false,
    // An import reads the records it may update, after the person running it was checked.
    overrideAccess: true,
  })
  return new Map(docs.map((doc) => [String(doc.slug), { ...doc } as Record<string, unknown>]))
}
