import type { ImportRow } from '@promisetracker/kernel'
import type { Payload, TypedLocale } from 'payload'

import { DEFAULT_LOCALE } from '../locales'
import type { ImportTarget, PlannedRow } from './targets'
import { existingBySlug, planRow } from './targets'

/** A problem with one row, by its row number in the spreadsheet, headings being row 1. */
export type RowError = { line: number; message: string }

export type ImportCounts = { create: number; update: number; skip: number; failed: number }

export type ImportResult = { counts: ImportCounts; errors: RowError[] }

type Input = {
  target: ImportTarget
  country: string
  headings: readonly string[]
  rows: readonly ImportRow[]
  mapping: Readonly<Record<string, string>>
  /** False for a preview, which saves nothing. */
  commit: boolean
}

/** How many row errors an import keeps. The count covers them all. */
const MAX_ERRORS = 500

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const id: unknown = Reflect.get(value, 'id')
    return typeof id === 'string' ? id : null
  }
  return null
}

const inLocale = (value: unknown, locale: string): unknown =>
  value && typeof value === 'object' ? Reflect.get(value, locale) : value

/** Whether a row would change nothing on the record it matches. */
function unchanged(
  current: Record<string, unknown>,
  plan: PlannedRow,
  parentId: string | null,
  localized: ReadonlySet<string>,
): boolean {
  for (const [key, value] of Object.entries(plan.data)) {
    const before = localized.has(key) ? inLocale(current[key], DEFAULT_LOCALE) : current[key]
    if (before !== value) return false
  }
  for (const [locale, values] of Object.entries(plan.translations)) {
    for (const [key, value] of Object.entries(values ?? {})) {
      if (inLocale(current[key], locale) !== value) return false
    }
  }
  return plan.parent === null || idOf(current.parent) === parentId
}

/**
 * Runs an import, or previews it (section 9.6). Each row matches a record by
 * country and slug, so importing the same file twice updates rather than
 * duplicates. Areas must come after their parents in the file.
 *
 * It writes as the system: the person running the import was checked when
 * they asked for it.
 */
export async function runImportPlan(payload: Payload, input: Input): Promise<ImportResult> {
  const existing = await existingBySlug(payload, input.target, input.country)
  const localized = new Set(['name', 'shortName'])
  // Slugs seen earlier in this file, with the record's id once it exists.
  const seen = new Map<string, string | null>()
  const counts: ImportCounts = { create: 0, update: 0, skip: 0, failed: 0 }
  const errors: RowError[] = []
  const fail = (line: number, message: string) => {
    counts.failed += 1
    if (errors.length < MAX_ERRORS) errors.push({ line, message })
  }

  for (const { row, values } of input.rows) {
    const line = row + 1
    const plan = planRow(input.target, input.headings, input.mapping, values, line)
    if (plan.slug && seen.has(plan.slug))
      plan.errors.push(`"${plan.slug}" appears earlier in the file.`)

    let parentId: string | null = null
    if (plan.parent) {
      const parentInDb = existing.get(plan.parent)
      if (parentInDb) parentId = idOf(parentInDb.id)
      else if (seen.has(plan.parent)) parentId = seen.get(plan.parent) ?? null
      else {
        plan.errors.push(
          `Parent "${plan.parent}" is not in this country. If it is in this file, put it above this row.`,
        )
      }
    }
    if (plan.errors.length > 0) {
      fail(line, plan.errors.join(' '))
      continue
    }

    const current = existing.get(plan.slug)
    if (current && unchanged(current, plan, parentId, localized)) {
      counts.skip += 1
      seen.set(plan.slug, idOf(current.id))
      continue
    }
    if (!input.commit) {
      counts[current ? 'update' : 'create'] += 1
      seen.set(plan.slug, current ? idOf(current.id) : null)
      continue
    }

    const data = {
      ...plan.data,
      slug: plan.slug,
      country: input.country,
      ...(plan.parent ? { parent: parentId } : {}),
    }
    try {
      const id = current
        ? idOf(
            (
              await payload.update({
                collection: input.target,
                id: String(current.id),
                locale: DEFAULT_LOCALE,
                data: data as never,
                overrideAccess: true,
              })
            ).id,
          )
        : idOf(
            (
              await payload.create({
                collection: input.target,
                locale: DEFAULT_LOCALE,
                data: data as never,
                overrideAccess: true,
              })
            ).id,
          )
      if (!id) throw new Error('The record was saved without an id.')
      for (const [locale, values] of Object.entries(plan.translations)) {
        await payload.update({
          collection: input.target,
          id,
          locale: locale as TypedLocale,
          data: values as never,
          overrideAccess: true,
        })
      }
      counts[current ? 'update' : 'create'] += 1
      seen.set(plan.slug, id)
    } catch (error) {
      fail(line, error instanceof Error ? error.message : String(error))
    }
  }
  return { counts, errors }
}
