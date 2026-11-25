import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { ImportRow } from '@promisetracker/kernel'
import type { CountryCode, ImportResult, ImportTarget } from '@promisetracker/plugin-core'
import { guessMapping, planRow, readCsv, runImportPlan, slugify } from '@promisetracker/plugin-core'
import type { Payload } from 'payload'

/**
 * Seed data for development: real countries, their places, offices and
 * office holders, so a collaborator has something to work with from the
 * first run. Each country is a folder in `seed/data`, holding one spreadsheet
 * per record type in the format editors import. Topics are shared by every
 * country, so they are one spreadsheet, `seed/data/topics.csv`.
 */

/** The countries with seed data, each a folder in `seed/data`. */
export const SEED_COUNTRIES = ['ke', 'sn'] as const satisfies readonly CountryCode[]
export type SeedCountry = (typeof SEED_COUNTRIES)[number]

/**
 * The order the spreadsheets load in: a record comes after the records it
 * names. Offices and areas name nothing outside their own file, so either can
 * go first. Terms name both, and actors. Claims name actors, areas and the
 * shared topics. Claim updates name claims, so they come last.
 */
export const SEED_ORDER = [
  'offices',
  'areas',
  'actors',
  'terms',
  'claims',
  'claim-updates',
] as const satisfies readonly ImportTarget[]
export type SeedTarget = (typeof SEED_ORDER)[number]

const DATA = path.resolve(import.meta.dirname, 'data')

/** One seed spreadsheet, read the way an import reads an upload. */
export function readSeed(
  code: SeedCountry,
  target: SeedTarget,
): { headings: string[]; rows: ImportRow[] } {
  const filename = `${target}.csv`
  const data = readFileSync(path.join(DATA, code, filename))
  return readCsv({ filename, mimeType: 'text/csv', data: new Uint8Array(data) })
}

/** The slug each row of a seed spreadsheet gets, as the import works it out. */
export function seedSlugs(code: SeedCountry, target: 'actors' | 'areas' | 'offices'): string[] {
  const { headings, rows } = readSeed(code, target)
  const mapping = guessMapping(target, headings)
  return rows.map((row) => planRow(target, headings, mapping, row.values, row.row + 1).slug)
}

/** The country's record, created and marked ready if it is not there yet. */
async function ensureCountry(
  payload: Payload,
  code: SeedCountry,
): Promise<{ id: string; note: string | null }> {
  const { docs } = await payload.find({
    collection: 'countries',
    where: { code: { equals: code } },
    depth: 0,
    limit: 1,
    // Seeding writes as the system.
    overrideAccess: true,
  })
  const [found] = docs
  if (found) {
    // An existing country keeps its settings, even one an editor is holding back.
    const note =
      found.recordStatus === 'ready'
        ? null
        : `The country is set to ${found.recordStatus}, so its pages do not show. Set it to ready in the admin to see them.`
    return { id: found.id, note }
  }
  const created = await payload.create({
    collection: 'countries',
    locale: 'en',
    // The name, region and languages fill in from the country list.
    data: { code, recordStatus: 'ready' },
    overrideAccess: true,
  })
  return { id: created.id, note: null }
}

export type SeedResult = {
  counts: Record<SeedTarget, ImportResult['counts']>
  /** Things worth telling whoever ran the seed. */
  notes: string[]
}

/**
 * Loads one country's seed data through the import, so it is checked the
 * way an editor's spreadsheet is. Running it again changes nothing: each row
 * matches the record it made before.
 */
export async function seedCountry(payload: Payload, code: SeedCountry): Promise<SeedResult> {
  const { id: country, note } = await ensureCountry(payload, code)
  const counts = {} as SeedResult['counts']
  for (const target of SEED_ORDER) {
    const { headings, rows } = readSeed(code, target)
    const result = await runImportPlan(payload, {
      target,
      country,
      headings,
      rows,
      mapping: guessMapping(target, headings),
      commit: true,
      // Actors and claims the seed creates are ready, so they appear on the
      // site. They save ready in one step, so an interrupted run leaves none
      // on hold. One that exists keeps its status, so one an editor held
      // stays held.
      ...(target === 'actors' || target === 'claims' || target === 'claim-updates'
        ? { onCreate: { recordStatus: 'ready' } }
        : {}),
    })
    if (result.errors.length > 0) {
      const lines = result.errors.map((e) => `  row ${e.line}: ${e.message}`).join('\n')
      throw new Error(`seed/data/${code}/${target}.csv has problems:\n${lines}`)
    }
    counts[target] = result.counts
  }
  return { counts, notes: note ? [note] : [] }
}

/** The topics every country shares, read from `seed/data/topics.csv`. */
export function readTopics(): { name: Record<string, string>; parent: string; colour: string }[] {
  const data = readFileSync(path.join(DATA, 'topics.csv'))
  const { headings, rows } = readCsv({
    filename: 'topics.csv',
    mimeType: 'text/csv',
    data: new Uint8Array(data),
  })
  const cell = (values: readonly string[], heading: string) =>
    values[headings.indexOf(heading)]?.trim() ?? ''
  return rows.map(({ values }) => ({
    name: {
      en: cell(values, 'Name'),
      fr: cell(values, 'Name (fr)'),
      sw: cell(values, 'Name (sw)'),
    },
    parent: cell(values, 'Parent'),
    colour: cell(values, 'Colour'),
  }))
}

/**
 * Adds the shared topics, parents first. A topic that exists, matched by its
 * slug, is left as it is, so an editor's changes stay.
 */
export async function seedTopics(payload: Payload): Promise<ImportResult['counts']> {
  const counts = { create: 0, update: 0, skip: 0, failed: 0 }
  const ids = new Map<string, string>()
  // Topics with no parent come first, so a child can name its parent.
  const topics = readTopics().sort((a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)))
  for (const topic of topics) {
    const slug = slugify(topic.name.en ?? '')
    const { docs } = await payload.find({
      collection: 'topics',
      where: { slug: { equals: slug } },
      depth: 0,
      limit: 1,
      // Seeding writes as the system.
      overrideAccess: true,
    })
    const [found] = docs
    if (found) {
      ids.set(slug, found.id)
      counts.skip += 1
      continue
    }
    const parent = topic.parent ? ids.get(slugify(topic.parent)) : undefined
    const created = await payload.create({
      collection: 'topics',
      locale: 'en',
      data: {
        name: topic.name.en ?? slug,
        slug,
        ...(parent ? { parent } : {}),
        ...(topic.colour ? { colour: topic.colour } : {}),
      },
      overrideAccess: true,
    })
    for (const locale of ['fr', 'sw'] as const) {
      const name = topic.name[locale]
      if (name) {
        await payload.update({
          collection: 'topics',
          id: created.id,
          locale,
          data: { name },
          overrideAccess: true,
        })
      }
    }
    ids.set(slug, created.id)
    counts.create += 1
  }
  return counts
}
