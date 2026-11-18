import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ImportRow } from '@promisetracker/kernel'
import type { CountryCode, ImportResult, ImportTarget } from '@promisetracker/plugin-core'
import { csvImporter, guessMapping, runImportPlan, slugify } from '@promisetracker/plugin-core'
import type { Payload } from 'payload'

/**
 * Seed data for development: real countries, their places, offices and
 * office holders, so a collaborator has something to work with from the
 * first run. Each country is a folder in `seed/data`, holding one spreadsheet
 * per record type in the format editors import.
 */

/** The countries with seed data, each a folder in `seed/data`. */
export const SEED_COUNTRIES = ['ke', 'sn'] as const satisfies readonly CountryCode[]
export type SeedCountry = (typeof SEED_COUNTRIES)[number]

/** The order the spreadsheets load in: a record comes after the records it names. */
export const SEED_ORDER = [
  'offices',
  'areas',
  'actors',
  'terms',
] as const satisfies readonly ImportTarget[]

const DATA = path.resolve(import.meta.dirname, 'data')

/** One seed spreadsheet, read the way an import reads an upload. */
export async function readSeed(
  code: SeedCountry,
  target: ImportTarget,
): Promise<{ headings: string[]; rows: ImportRow[] }> {
  const filename = `${target}.csv`
  const data = readFileSync(path.join(DATA, code, filename))
  const content = { filename, mimeType: 'text/csv', data: new Uint8Array(data) }
  const ctx = {} as Parameters<typeof csvImporter.inspect>[1]
  const { headings } = await csvImporter.inspect(content, ctx)
  const rows: ImportRow[] = []
  for await (const row of csvImporter.rows(content, ctx)) rows.push(row)
  return { headings, rows }
}

/** The country's record, created and marked ready if it is not there yet. */
async function ensureCountry(payload: Payload, code: SeedCountry): Promise<string> {
  const { docs } = await payload.find({
    collection: 'countries',
    where: { code: { equals: code } },
    depth: 0,
    limit: 1,
    // Seeding writes as the system.
    overrideAccess: true,
  })
  const [found] = docs
  if (found) return found.id
  const created = await payload.create({
    collection: 'countries',
    locale: 'en',
    // The name, region and languages fill in from the country list.
    data: { code, recordStatus: 'ready' },
    overrideAccess: true,
  })
  return created.id
}

export type SeedResult = Record<(typeof SEED_ORDER)[number], ImportResult['counts']>

/**
 * Loads one country's seed data through the import, so it is checked the
 * way an editor's spreadsheet is. Running it again changes nothing: each row
 * matches the record it made before. Seeded actors are marked ready, so they
 * appear on the site.
 */
export async function seedCountry(payload: Payload, code: SeedCountry): Promise<SeedResult> {
  const country = await ensureCountry(payload, code)
  const result = {} as SeedResult
  for (const target of SEED_ORDER) {
    const { headings, rows } = await readSeed(code, target)
    const { counts, errors } = await runImportPlan(payload, {
      target,
      country,
      headings,
      rows,
      mapping: guessMapping(target, headings),
      commit: true,
    })
    if (errors.length > 0) {
      const lines = errors.map((e) => `  row ${e.line}: ${e.message}`).join('\n')
      throw new Error(`seed/data/${code}/${target}.csv has problems:\n${lines}`)
    }
    result[target] = counts
    if (target === 'actors') {
      const name = headings.indexOf('Name')
      const slugs = rows.map((row) => slugify(row.values[name] ?? ''))
      await payload.update({
        collection: 'actors',
        where: { and: [{ country: { equals: country } }, { slug: { in: slugs } }] },
        data: { recordStatus: 'ready' },
        overrideAccess: true,
      })
    }
  }
  return result
}
