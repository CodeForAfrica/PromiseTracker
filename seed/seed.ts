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

// Editorial content (section 7.7): `seed/data/editorial.json`.

type Localized = { en: string; fr?: string }
type Block = { p: string } | { h2: string } | { link: { text: string; url: string } }
type EditorialSeed = {
  partners: { name: string; url: string }[]
  sisterTools: { name: string; url: string; description: Localized }[]
  themes: {
    slug: string
    title: Localized
    introduction: Localized
    countries: string[]
    claims: [string, string][]
  }[]
  articles: {
    country: string
    slug: string
    about: ['claims' | 'actors', string]
    date: string
    title: Localized
    standfirst: Localized
    body: { en: Block[]; fr?: Block[] }
  }[]
  pages: {
    slug: string
    title: Localized
    summary: Localized
    body: { en: Block[]; fr?: Block[] }
  }[]
  picks: { featuredClaim: [string, string]; inFocus: string; featuredArea: [string, string] }
  countryPicks: { country: string; actors: string[]; claims: string[] }[]
}

export const readEditorial = (): EditorialSeed =>
  JSON.parse(readFileSync(path.join(DATA, 'editorial.json'), 'utf8')) as EditorialSeed

const text = (value: string) => ({
  type: 'text',
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

/** Rich text, as the admin's editor saves it, from paragraphs, headings and links. */
export function richText(blocks: readonly Block[]) {
  const node = { format: '', indent: 0, version: 1, direction: 'ltr' as const }
  return {
    root: {
      ...node,
      type: 'root',
      children: blocks.map((block) => {
        if ('h2' in block)
          return { ...node, type: 'heading', tag: 'h2', children: [text(block.h2)] }
        if ('link' in block) {
          return {
            ...node,
            type: 'paragraph',
            textFormat: 0,
            textStyle: '',
            children: [
              {
                ...node,
                type: 'link',
                fields: { url: block.link.url, newTab: false, linkType: 'custom' },
                children: [text(block.link.text)],
              },
            ],
          }
        }
        return {
          ...node,
          type: 'paragraph',
          textFormat: 0,
          textStyle: '',
          children: [text(block.p)],
        }
      }),
    },
  }
}

/** Seeding writes as the system. */
const system = { overrideAccess: true, depth: 0 } as const

/** A record's id by slug, in a country when given. */
async function idBySlug(
  payload: Payload,
  collection: 'claims' | 'actors' | 'areas' | 'countries' | 'themes' | 'articles' | 'pages',
  slug: string,
  country?: string,
): Promise<string | null> {
  const field = collection === 'countries' ? 'code' : 'slug'
  const { docs } = await payload.find({
    collection,
    where: {
      and: [{ [field]: { equals: slug } }, ...(country ? [{ country: { equals: country } }] : [])],
    },
    limit: 1,
    trash: true,
    ...system,
  })
  return docs[0]?.id ?? null
}

/**
 * Adds the editorial content: partners, sister tools, a theme, an article,
 * the methodology page, and the homepage and country picks. Anything that
 * exists, matched by its slug or name, is left as it is, and picks already
 * set are kept, so an editor's changes stay.
 */
export async function seedEditorial(payload: Payload): Promise<ImportResult['counts']> {
  const seed = readEditorial()
  const counts = { create: 0, update: 0, skip: 0, failed: 0 }
  const country = async (code: string) => {
    const id = await idBySlug(payload, 'countries', code)
    if (!id) throw new Error(`Seed the country ${code} before its editorial content.`)
    return id
  }
  const claim = async (code: string, title: string) => {
    const id = await idBySlug(payload, 'claims', slugify(title), await country(code))
    if (!id) throw new Error(`The editorial seed names a claim not in ${code}: ${title}`)
    return id
  }

  for (const [collection, list] of [
    ['partners', seed.partners],
    ['sister-tools', seed.sisterTools],
  ] as const) {
    for (const entry of list) {
      const { totalDocs } = await payload.count({
        collection,
        where: { name: { equals: entry.name } },
        overrideAccess: true,
      })
      if (totalDocs > 0) {
        counts.skip += 1
        continue
      }
      const description = 'description' in entry ? entry.description : null
      const created = await payload.create({
        collection,
        locale: 'en',
        data: {
          name: entry.name,
          url: entry.url,
          ...(description ? { description: description.en } : {}),
        },
        ...system,
      })
      if (description?.fr) {
        await payload.update({
          collection,
          id: created.id,
          locale: 'fr',
          data: { description: description.fr },
          ...system,
        })
      }
      counts.create += 1
    }
  }

  /** Creates a record ready in English, then adds its French. */
  const createReady = async (
    collection: 'themes' | 'articles' | 'pages',
    en: Record<string, unknown>,
    fr: Record<string, unknown> | null,
  ) => {
    const created = await payload.create({
      collection,
      locale: 'en',
      data: { ...en, recordStatus: 'ready' } as never,
      ...system,
    })
    if (fr) {
      await payload.update({
        collection,
        id: created.id,
        locale: 'fr',
        data: fr as never,
        ...system,
      })
    }
    counts.create += 1
  }

  for (const theme of seed.themes) {
    if (await idBySlug(payload, 'themes', theme.slug)) {
      counts.skip += 1
      continue
    }
    const claims = []
    for (const [code, title] of theme.claims) claims.push(await claim(code, title))
    const countries = []
    for (const code of theme.countries) countries.push(await country(code))
    await createReady(
      'themes',
      {
        slug: theme.slug,
        title: theme.title.en,
        introduction: theme.introduction.en,
        claims,
        countries,
      },
      theme.title.fr ? { title: theme.title.fr, introduction: theme.introduction.fr } : null,
    )
  }

  for (const article of seed.articles) {
    const countryId = await country(article.country)
    if (await idBySlug(payload, 'articles', article.slug, countryId)) {
      counts.skip += 1
      continue
    }
    const [relationTo, name] = article.about
    const value =
      relationTo === 'claims'
        ? await claim(article.country, name)
        : await idBySlug(payload, 'actors', name, countryId)
    if (!value)
      throw new Error(`The editorial seed's article names an unknown ${relationTo}: ${name}`)
    await createReady(
      'articles',
      {
        slug: article.slug,
        country: countryId,
        about: { relationTo, value },
        date: article.date,
        title: article.title.en,
        standfirst: article.standfirst.en,
        body: richText(article.body.en),
      },
      article.title.fr
        ? {
            title: article.title.fr,
            standfirst: article.standfirst.fr,
            ...(article.body.fr ? { body: richText(article.body.fr) } : {}),
          }
        : null,
    )
  }

  for (const page of seed.pages) {
    if (await idBySlug(payload, 'pages', page.slug)) {
      counts.skip += 1
      continue
    }
    await createReady(
      'pages',
      {
        slug: page.slug,
        title: page.title.en,
        summary: page.summary.en,
        body: richText(page.body.en),
      },
      page.title.fr
        ? {
            title: page.title.fr,
            summary: page.summary.fr,
            ...(page.body.fr ? { body: richText(page.body.fr) } : {}),
          }
        : null,
    )
  }

  const site = await payload.findGlobal({ slug: 'site', ...system })
  const picks = site.picks ?? {}
  const unset = !picks.featuredClaim && !picks.inFocus && !picks.featuredArea
  const [featuredCode, featuredTitle] = seed.picks.featuredClaim
  const [areaCode, areaSlug] = seed.picks.featuredArea
  const known = new Set(
    (site.countryPicks ?? []).map((p) =>
      typeof p.country === 'string' ? p.country : p.country?.id,
    ),
  )
  const countryPicks = []
  for (const entry of seed.countryPicks) {
    const id = await country(entry.country)
    if (known.has(id)) continue
    const actors = []
    for (const slug of entry.actors) {
      const actor = await idBySlug(payload, 'actors', slug, id)
      if (actor) actors.push(actor)
    }
    const claims = []
    for (const title of entry.claims) claims.push(await claim(entry.country, title))
    countryPicks.push({ country: id, actors, claims })
  }
  if (unset || countryPicks.length > 0) {
    await payload.updateGlobal({
      slug: 'site',
      data: {
        ...(unset
          ? {
              picks: {
                featuredClaim: await claim(featuredCode, featuredTitle),
                inFocus: await idBySlug(payload, 'themes', seed.picks.inFocus),
                featuredArea: await idBySlug(payload, 'areas', areaSlug, await country(areaCode)),
              },
            }
          : {}),
        countryPicks: [
          ...(site.countryPicks ?? []).map((p) => ({
            country: typeof p.country === 'string' ? p.country : p.country?.id,
            actors: (p.actors ?? []).map((a) => (typeof a === 'string' ? a : a.id)),
            claims: (p.claims ?? []).map((c) => (typeof c === 'string' ? c : c.id)),
          })),
          ...countryPicks,
        ],
      } as never,
      ...system,
    })
    counts.update += 1
  } else {
    counts.skip += 1
  }
  return counts
}
