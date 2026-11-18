import type {
  ActorRef,
  ActorSummary,
  Area,
  AreaSummary,
  Country,
  CountryList,
  CountrySummary,
  Holder,
  Image,
  Language,
  NotAvailable,
  Office,
  SeatRef,
  SiteInfo,
  Term,
} from '@promisetracker/contract'
import {
  ActorList as ActorListSchema,
  Actor as ActorSchema,
  AreaList as AreaListSchema,
  Area as AreaSchema,
  CountryList as CountryListSchema,
  Country as CountrySchema,
  OfficeList as OfficeListSchema,
  Redirect as RedirectSchema,
  SeatHolders as SeatHoldersSchema,
  SiteInfo as SiteInfoSchema,
} from '@promisetracker/contract'
import {
  countryName,
  currentTerms,
  isCountryCode,
  onRecord,
  pastTerms,
  publishedInLocale,
  termStage,
} from '@promisetracker/plugin-core'
import { resolveStrings } from '@promisetracker/plugin-site'
import type { Payload, TypedLocale, Where } from 'payload'

import { areaFamily } from '../areaTree'
import { kernel } from '../kernel'
import { registeredLocales } from '../locales'
import type {
  Actor as ActorDoc,
  Area as AreaDoc,
  Country as CountryDoc,
  Office as OfficeDoc,
  Site,
  Term as TermDoc,
} from '../payload-types'

/**
 * Handlers for `/api/v1`. The HTTP route and the SDK's local transport both
 * call these, so the site gets the same data however it is deployed.
 *
 * Records come typed from Payload's generated types. Each mapper turns one
 * into its public shape from the contract, so a change on either side fails
 * the type check here, and the result is parsed again at run time.
 *
 * Every read runs as a guest, with access rules on, in one language.
 */

export type V1Result = { status: 200 | 400 | 404; body: unknown }

const ok = (body: unknown): V1Result => ({ status: 200, body })
const notFound = (): V1Result => ({ status: 404, body: { error: 'not-found' } })

/** The languages the site runs in, the default first (D45). */
export const languages = (): Language[] =>
  kernel.locales.map((l) => ({ code: l.code, label: l.label, rtl: l.rtl ?? false }))

const text = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() ? value : null

type Link = { label?: string | null; url?: string | null }
/** Links with a label in this language. A link not yet translated is left out. */
const links = (items: readonly Link[] | null | undefined) =>
  (items ?? []).flatMap((item) => {
    const label = text(item.label)
    const url = text(item.url)
    return label && url ? [{ label, url }] : []
  })

const toSiteInfo = (site: Site, locale: string): SiteInfo =>
  SiteInfoSchema.parse({
    name: site.name,
    locale,
    defaultLanguage: kernel.defaultLocale,
    languages: languages(),
    description: text(site.description),
    explainer: text(site.explainer),
    strings: resolveStrings(locale, site.strings),
    navigation: links(site.navigation),
    footer: { about: text(site.footer?.about), links: links(site.footer?.links) },
  })

/** A published country always has a name. The standard one covers a gap all the same. */
const nameOf = (doc: CountryDoc, locale: TypedLocale): string =>
  text(doc.name) ?? (isCountryCode(doc.code) ? countryName(doc.code, locale) : doc.code)

const toSummary = (doc: CountryDoc, locale: TypedLocale): CountrySummary => ({
  code: doc.code,
  name: nameOf(doc, locale),
  region: doc.region ?? null,
})

const toCountry = (doc: CountryDoc, locale: TypedLocale, counts: Country['counts']): Country =>
  CountrySchema.parse({
    ...toSummary(doc, locale),
    about: text(doc.about),
    defaultLanguage: doc.defaultLanguage ?? null,
    counts,
  })

type Context = {
  payload: Payload
  params: Record<string, string>
  locale: TypedLocale
  query: URLSearchParams
}

const notAvailable = (codes: readonly string[]): V1Result => {
  const availableIn = languages().filter((l) => codes.includes(l.code))
  if (availableIn.length === 0) return notFound()
  const body: NotAvailable = { error: 'not-available', availableIn }
  return { status: 404, body }
}

/**
 * The country a place belongs to, if it is published in this language. A
 * country's places are public wherever it is (section 8.1). Anything else
 * answers as the country would.
 */
async function publishedCountry(
  payload: Payload,
  code: string,
  locale: TypedLocale,
): Promise<CountryDoc | V1Result> {
  if (!isCountryCode(code)) return notFound()
  const { docs } = await payload.find({
    collection: 'countries',
    where: { code: { equals: code } },
    locale,
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const [doc] = docs
  if (!doc) return notFound()
  return (doc.publishedIn ?? []).includes(locale) ? doc : notAvailable(doc.publishedIn ?? [])
}

const isResult = (value: CountryDoc | V1Result): value is V1Result => 'status' in value

const toOffice = (doc: OfficeDoc): Office | null => {
  const name = text(doc.name)
  // A save always gives a slug. Without one a record has no address, so it is left out.
  if (!name || !doc.slug) return null
  return {
    slug: doc.slug,
    name,
    shortName: text(doc.shortName),
    areaType: doc.areaType ?? null,
    holdersPerSeat: doc.holdersPerSeat,
  }
}

/** A country's offices with a name in this language, highest first. */
async function officesOf(
  payload: Payload,
  country: string,
  locale: TypedLocale,
): Promise<Office[]> {
  const { docs } = await payload.find({
    collection: 'offices',
    where: { country: { equals: country } },
    locale,
    sort: 'order',
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs.map(toOffice).filter((o): o is Office => o !== null)
}

const toAreaSummary = (doc: AreaDoc): AreaSummary | null => {
  const name = text(doc.name)
  return name && doc.slug ? { slug: doc.slug, name, type: doc.type } : null
}

/** A localized value, read with every language, in one of them. */
const nameIn = (value: unknown, locale: string): string | null => {
  const inLocale: unknown = value && typeof value === 'object' ? Reflect.get(value, locale) : null
  return typeof inLocale === 'string' ? text(inLocale) : null
}

/** A language the site runs in: registered, and switched on by PT_LOCALES. */
const inUse = (value: string): value is TypedLocale =>
  registeredLocales.some((l) => l.code === value) && kernel.locales.some((l) => l.code === value)
type Handler = (ctx: Context) => Promise<V1Result>

/** A date as YYYY-MM-DD. */
const day = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value ? value.slice(0, 10) : null

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' ? id : null
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Records with one of these ids. With none, it matches nothing. */
const idIn = (ids: Iterable<string | null>): Where => {
  const list = [...new Set(ids)].filter((id): id is string => Boolean(id))
  return list.length > 0 ? { id: { in: list } } : { id: { exists: false } }
}

/**
 * Actors a guest may see in this language: ready, published in it, in this
 * country, and on the record, which for a person means a term has started
 * (section 8.1). The country is checked by the caller.
 */
const publicActors = (country: string, locale: TypedLocale, now: Date, extra?: Where): Where => ({
  and: [
    { country: { equals: country } },
    publishedInLocale(locale),
    onRecord(now),
    ...(extra ? [extra] : []),
  ],
})

async function findActors(
  payload: Payload,
  where: Where,
  locale: TypedLocale,
): Promise<Map<string, ActorDoc>> {
  const { docs } = await payload.find({
    collection: 'actors',
    where,
    locale,
    // The image, for its address.
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })
  return new Map(docs.map((doc) => [doc.id, doc]))
}

const toActorRef = (doc: ActorDoc | undefined): ActorRef | null =>
  doc?.slug ? { slug: doc.slug, name: doc.name, kind: doc.kind } : null

const imageOf = (doc: ActorDoc): Image | null => {
  const media = doc.image
  if (!media || typeof media !== 'object' || !media.url) return null
  return { url: media.url, alt: text(media.alt) ?? doc.name, credit: text(doc.imageCredit) }
}

type OfficeEntry = { id: string; office: Office; order: number }

/** A country's offices with a name in this language, by id, highest first. */
async function officeMap(
  payload: Payload,
  country: string,
  locale: TypedLocale,
): Promise<Map<string, OfficeEntry>> {
  const { docs } = await payload.find({
    collection: 'offices',
    where: { country: { equals: country } },
    locale,
    sort: 'order',
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  const entries = docs.flatMap((doc) => {
    const office = toOffice(doc)
    return office ? [[doc.id, { id: doc.id, office, order: doc.order }] as const] : []
  })
  return new Map(entries)
}

/** Areas by id, with a name in this language. */
async function areaMap(
  payload: Payload,
  ids: readonly string[],
  locale: TypedLocale,
): Promise<Map<string, AreaSummary>> {
  if (ids.length === 0) return new Map()
  const { docs } = await payload.find({
    collection: 'areas',
    where: idIn(ids),
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return new Map(
    docs.flatMap((doc) => {
      const summary = toAreaSummary(doc)
      return summary ? [[doc.id, summary] as const] : []
    }),
  )
}

/** Terms as a guest sees them, in one country. */
async function findTerms(
  payload: Payload,
  country: string,
  locale: TypedLocale,
  where: Where,
  sort = '-startsOn',
): Promise<TermDoc[]> {
  const { docs } = await payload.find({
    collection: 'terms',
    where: { and: [{ country: { equals: country } }, where] },
    locale,
    sort,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

const seatKey = (office: unknown, area: unknown) => `${idOf(office) ?? ''}|${idOf(area) ?? ''}`

/** The public holders of each seat matching `where`, today, by seat. */
async function holdersBySeat(
  payload: Payload,
  country: string,
  locale: TypedLocale,
  where: Where,
  now: Date = new Date(),
): Promise<Map<string, Holder[]>> {
  const terms = await findTerms(payload, country, locale, { and: [currentTerms(now), where] })
  if (terms.length === 0) return new Map()
  const ids = [...terms.flatMap((t) => [idOf(t.actor), idOf(t.party)])].filter(
    (id): id is string => id !== null,
  )
  const actors = await findActors(payload, publicActors(country, locale, now, idIn(ids)), locale)
  const seats = new Map<string, Holder[]>()
  for (const term of terms) {
    const actor = actors.get(idOf(term.actor) ?? '')
    const ref = toActorRef(actor)
    if (!actor || !ref) continue
    const key = seatKey(term.office, term.area)
    const holder: Holder = {
      ...ref,
      image: imageOf(actor),
      party: toActorRef(actors.get(idOf(term.party) ?? '')),
    }
    seats.set(key, [...(seats.get(key) ?? []), holder])
  }
  for (const holders of seats.values()) holders.sort((a, b) => a.name.localeCompare(b.name))
  return seats
}

/** What the rules for the country page's sections need (section 10.3). */
async function sectionCounts(
  payload: Payload,
  country: string,
  locale: TypedLocale,
): Promise<Country['counts']> {
  const holders = await holdersBySeat(payload, country, locale, {})
  const current = new Set([...holders.values()].flat().map((h) => h.slug))
  const now = new Date()
  const past = await findTerms(payload, country, locale, pastTerms(now))
  const actors = await findActors(
    payload,
    publicActors(country, locale, now, idIn(past.map((t) => idOf(t.actor)))),
    locale,
  )
  return {
    currentHolders: current.size,
    pastTerms: past.filter((t) => actors.has(idOf(t.actor) ?? '')).length,
  }
}

/** Finds a record by its slug in a country, or by a slug it had before (section 11.2). */
async function bySlug<C extends 'areas' | 'offices' | 'actors'>(
  payload: Payload,
  collection: C,
  country: string,
  slug: string,
  former = false,
): Promise<{ id: string; slug?: string | null; areaType?: string | null; type?: string } | null> {
  const { docs } = await payload.find({
    collection,
    where: {
      and: [
        { country: { equals: country } },
        former ? { formerSlugs: { in: [slug] } } : { slug: { equals: slug } },
      ],
    },
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  return docs[0] ?? null
}

const isNational = (office: { areaType?: string | null }) =>
  !office.areaType || office.areaType === 'country'

/**
 * A seat by address: a national office alone, or an area and an office of
 * the kind the area is. Null when the address is not a seat.
 */
async function findSeat(
  payload: Payload,
  country: string,
  officeSlug: string,
  areaSlug: string | null,
) {
  const office = await bySlug(payload, 'offices', country, officeSlug)
  if (!office) return null
  if (areaSlug === null) return isNational(office) ? { office, area: null } : null
  const area = await bySlug(payload, 'areas', country, areaSlug)
  if (!area || isNational(office) || area.type !== office.areaType) return null
  return { office, area }
}

const termsByOffice = (offices: ReadonlyMap<string, OfficeEntry>) => (a: TermDoc, b: TermDoc) =>
  (offices.get(idOf(a.office) ?? '')?.order ?? 0) - (offices.get(idOf(b.office) ?? '')?.order ?? 0)

const PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

const handlers: Record<string, Handler> = {
  '/site': async ({ payload, locale }) =>
    ok(
      toSiteInfo(await payload.findGlobal({ slug: 'site', locale, overrideAccess: false }), locale),
    ),

  '/countries': async ({ payload, locale }) => {
    const result = await payload.find({
      collection: 'countries',
      where: publishedInLocale(locale),
      locale,
      sort: 'code',
      depth: 0,
      pagination: false,
      overrideAccess: false,
    })
    const list: CountryList = CountryListSchema.parse({
      items: result.docs.map((doc) => toSummary(doc, locale)),
      total: result.totalDocs,
      // Countries are few, so every one comes in the first page.
      nextCursor: null,
    })
    return ok(list)
  },

  '/countries/:code': async ({ payload, params, locale }) => {
    // Only codes on the country list exist, and the database refuses any other.
    if (!isCountryCode(params.code)) return notFound()
    const { docs } = await payload.find({
      collection: 'countries',
      where: { code: { equals: params.code } },
      locale,
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    if ((doc.publishedIn ?? []).includes(locale))
      return ok(toCountry(doc, locale, await sectionCounts(payload, doc.id, locale)))
    const availableIn = languages().filter((l) => (doc.publishedIn ?? []).includes(l.code))
    if (availableIn.length === 0) return notFound()
    const body: NotAvailable = { error: 'not-available', availableIn }
    return { status: 404, body }
  },

  '/countries/:code/offices': async ({ payload, params, locale }) => {
    const country = await publishedCountry(payload, params.code ?? '', locale)
    if (isResult(country)) return country
    return ok(OfficeListSchema.parse({ items: await officesOf(payload, country.id, locale) }))
  },

  '/countries/:code/areas': async ({ payload, params, locale, query }) => {
    const country = await publishedCountry(payload, params.code ?? '', locale)
    if (isResult(country)) return country
    const parentSlug = query.get('parent')
    let parent: string | null = null
    if (parentSlug) {
      const { docs } = await payload.find({
        collection: 'areas',
        where: { and: [{ country: { equals: country.id } }, { slug: { equals: parentSlug } }] },
        depth: 0,
        limit: 1,
        overrideAccess: false,
      })
      const [found] = docs
      if (!found) return notFound()
      parent = found.id
    }
    const { docs } = await payload.find({
      collection: 'areas',
      where: {
        and: [
          { country: { equals: country.id } },
          parent ? { parent: { equals: parent } } : { parent: { exists: false } },
        ],
      },
      locale,
      sort: 'slug',
      depth: 0,
      pagination: false,
      overrideAccess: false,
    })
    const items = docs.map(toAreaSummary).filter((a): a is AreaSummary => a !== null)
    // A country's areas at one level are few, so they all come in the first page.
    return ok(AreaListSchema.parse({ items, total: items.length, nextCursor: null }))
  },

  '/countries/:code/areas/:area': async ({ payload, params, locale }) => {
    const country = await publishedCountry(payload, params.code ?? '', locale)
    if (isResult(country)) return country
    const { docs } = await payload.find({
      collection: 'areas',
      where: { and: [{ country: { equals: country.id } }, { slug: { equals: params.area } }] },
      locale: 'all',
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const name = nameIn(doc.name, locale)
    if (!name)
      return notAvailable((country.publishedIn ?? []).filter((code) => nameIn(doc.name, code)))
    const family = await areaFamily(payload, doc.id)
    const above = family.ancestors.length
      ? (
          await payload.find({
            collection: 'areas',
            where: { id: { in: family.ancestors } },
            locale,
            depth: 0,
            pagination: false,
            overrideAccess: false,
          })
        ).docs
      : []
    // The query gives the nearest first. The page wants the country first.
    const rank = new Map(family.ancestors.map((id, i) => [id, i]))
    const ancestors = above
      .sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0))
      .map(toAreaSummary)
      .filter((a): a is AreaSummary => a !== null)
    const offices = await officeMap(payload, country.id, locale)
    const holders = await holdersBySeat(payload, country.id, locale, {
      area: { equals: doc.id },
    })
    const seats = [...offices.values()]
      .filter(({ office }) => office.areaType === doc.type)
      .map(({ id, office }) => ({
        office: { slug: office.slug, name: office.name, shortName: office.shortName },
        holdersPerSeat: office.holdersPerSeat,
        holders: holders.get(seatKey(id, doc.id)) ?? [],
      }))
    const { totalDocs: children } = await payload.count({
      collection: 'areas',
      where: { parent: { equals: doc.id } },
      overrideAccess: false,
    })
    const hasPage = doc.page === 'always' || (doc.page === 'automatic' && seats.length >= 2)
    const area: Area = AreaSchema.parse({
      slug: doc.slug,
      name,
      type: doc.type,
      ancestors,
      seats,
      hasPage,
      children,
    })
    return ok(area)
  },

  '/countries/:code/seats/:office': async ({ payload, params, locale }) =>
    seatHandler(payload, params.code ?? '', locale, params.office ?? '', null),

  '/countries/:code/seats/:area/:office': async ({ payload, params, locale }) =>
    seatHandler(payload, params.code ?? '', locale, params.office ?? '', params.area ?? null),

  '/countries/:code/actors': async ({ payload, params, locale, query }) => {
    const country = await publishedCountry(payload, params.code ?? '', locale)
    if (isResult(country)) return country
    const now = new Date()
    const empty = () => ok(ActorListSchema.parse({ items: [], total: 0, nextCursor: null }))
    const offices = await officeMap(payload, country.id, locale)

    // Filters by seat: an office, an area or a party, at a stage.
    const termFilters: Where[] = []
    for (const [param, collection] of [
      ['office', 'offices'],
      ['area', 'areas'],
      ['party', 'actors'],
    ] as const) {
      const slug = query.get(param)
      if (!slug) continue
      const found = SLUG.test(slug) ? await bySlug(payload, collection, country.id, slug) : null
      if (!found) return empty()
      termFilters.push({ [param]: { equals: found.id } })
    }
    const stage = query.get('stage')
    if (stage && stage !== 'current' && stage !== 'past') return badRequest('stage')
    let ids: Set<string> | null = null
    if (stage || termFilters.length > 0) {
      const byStage = stage === 'past' ? pastTerms(now) : currentTerms(now)
      const terms = await findTerms(payload, country.id, locale, {
        and: [byStage, ...termFilters],
      })
      ids = new Set(terms.map((t) => idOf(t.actor) ?? ''))
    }
    const kind = query.get('kind')
    if (kind && kind !== 'person' && kind !== 'party' && kind !== 'institution') {
      return badRequest('kind')
    }
    const actors = await findActors(
      payload,
      publicActors(country.id, locale, now, {
        and: [...(ids ? [idIn(ids)] : []), ...(kind ? [{ kind: { equals: kind } }] : [])],
      }),
      locale,
    )
    if (actors.size === 0) return empty()

    // Each actor's seats today, and their party.
    const current = (
      await findTerms(payload, country.id, locale, {
        and: [currentTerms(now), { actor: { in: [...actors.keys()] } }],
      })
    ).sort(termsByOffice(offices))
    const areas = await areaMap(
      payload,
      current.map((t) => idOf(t.area) ?? '').filter(Boolean),
      locale,
    )
    const parties = await findActors(
      payload,
      publicActors(country.id, locale, now, idIn(current.map((t) => idOf(t.party)))),
      locale,
    )
    const rank = new Map<string, number>()
    const items: ActorSummary[] = []
    for (const actor of actors.values()) {
      const ref = toActorRef(actor)
      if (!ref) continue
      const own = current.filter((t) => idOf(t.actor) === actor.id)
      const seats = own.flatMap((t): SeatRef[] => {
        const entry = offices.get(idOf(t.office) ?? '')
        if (!entry) return []
        const area = idOf(t.area)
        return [{ office: officeRef(entry.office), area: area ? (areas.get(area) ?? null) : null }]
      })
      rank.set(ref.slug, offices.get(idOf(own[0]?.office) ?? '')?.order ?? Number.MAX_SAFE_INTEGER)
      items.push({
        ...ref,
        image: imageOf(actor),
        party: toActorRef(parties.get(idOf(own[0]?.party) ?? '')),
        stage: own.length > 0 || actor.kind !== 'person' ? 'current' : 'past',
        seats,
      })
    }
    // Sorted and paged here, not in the database: the order by office needs
    // each actor's highest seat. That suits a country's few hundred office
    // holders. A country tracking thousands of ward seats would need the
    // sort moved into the query.
    const byName = (a: ActorSummary, b: ActorSummary) => a.name.localeCompare(b.name, locale)
    const sort = query.get('sort') ?? 'name'
    if (sort !== 'name' && sort !== 'office') return badRequest('sort')
    items.sort(
      sort === 'office'
        ? (a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0) || byName(a, b)
        : byName,
    )
    const start = Number(query.get('cursor') ?? '0')
    const size = Number(query.get('limit') ?? PAGE_SIZE)
    if (!Number.isInteger(start) || start < 0) return badRequest('cursor')
    if (!Number.isInteger(size) || size < 1 || size > MAX_PAGE_SIZE) return badRequest('limit')
    const end = start + size
    return ok(
      ActorListSchema.parse({
        items: items.slice(start, end),
        total: items.length,
        nextCursor: end < items.length ? String(end) : null,
      }),
    )
  },

  '/countries/:code/actors/:slug': async ({ payload, params, locale }) => {
    const country = await publishedCountry(payload, params.code ?? '', locale)
    if (isResult(country)) return country
    const now = new Date()
    const [actor] = (
      await findActors(
        payload,
        publicActors(country.id, locale, now, { slug: { equals: params.slug } }),
        locale,
      )
    ).values()
    const ref = toActorRef(actor)
    if (!actor || !ref) return notFound()
    const offices = await officeMap(payload, country.id, locale)
    // Terms not yet started are left out: a candidacy is not on the record.
    const terms = (await findTerms(payload, country.id, locale, { actor: { equals: actor.id } }))
      .map((term) => ({ term, stage: termStage(term, now) }))
      .filter(({ stage }) => stage !== 'candidate')
    const areas = await areaMap(
      payload,
      terms.map(({ term }) => idOf(term.area) ?? '').filter(Boolean),
      locale,
    )
    const named = await findActors(
      payload,
      publicActors(
        country.id,
        locale,
        now,
        idIn(terms.flatMap(({ term }) => [idOf(term.party), idOf(term.successor)])),
      ),
      locale,
    )
    const list = terms.flatMap(({ term, stage }): Term[] => {
      const entry = offices.get(idOf(term.office) ?? '')
      if (!entry) return []
      const area = idOf(term.area)
      return [
        {
          office: officeRef(entry.office),
          area: area ? (areas.get(area) ?? null) : null,
          party: toActorRef(named.get(idOf(term.party) ?? '')),
          electedOn: day(term.electedOn),
          startsOn: day(term.startsOn) ?? '',
          endsOn: day(term.endsOn),
          stage,
          closingSummary: text(term.closingSummary),
          successor: toActorRef(named.get(idOf(term.successor) ?? '')),
        },
      ]
    })
    const current = list.filter((t) => t.stage === 'current')
    const [lead] = [...current].sort(
      (a, b) =>
        (offices.get(officeId(offices, a.office.slug))?.order ?? 0) -
        (offices.get(officeId(offices, b.office.slug))?.order ?? 0),
    )
    return ok(
      ActorSchema.parse({
        ...ref,
        image: imageOf(actor),
        party: (lead ?? list[0])?.party ?? null,
        stage: current.length > 0 || actor.kind !== 'person' ? 'current' : 'past',
        seats: current.map(({ office, area }) => ({ office, area })),
        shortName: text(actor.shortName),
        honorific: text(actor.honorific),
        institutionType: actor.institutionType ?? null,
        biography: text(actor.biography),
        links: (actor.links ?? []).map(({ type, url }) => ({ type, url })),
        terms: list,
      }),
    )
  },

  '/redirects': async ({ payload, locale, query }) => {
    const parts = (query.get('path') ?? '').split('/').filter(Boolean)
    const [code = '', ...rest] = parts
    if (!rest.every((part) => SLUG.test(part))) return notFound()
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return notFound()
    const permanent = (to: string) => ok(RedirectSchema.parse({ to, permanent: true }))
    const toHolder = async (office: string, area: string | null) => {
      const seat = await findSeat(payload, country.id, office, area)
      if (!seat) return null
      const holders = await seatHolders(payload, country.id, locale, seat)
      const [only] = holders
      return holders.length === 1 && only
        ? ok(RedirectSchema.parse({ to: `/${code}/e/${only.slug}`, permanent: false }))
        : null
    }
    const current = async (collection: 'areas' | 'offices' | 'actors', slug: string) =>
      (await bySlug(payload, collection, country.id, slug)) ??
      (await bySlug(payload, collection, country.id, slug, true))

    if (rest[0] === 'e' && rest.length === 2) {
      const actor = await bySlug(payload, 'actors', country.id, rest[1] ?? '', true)
      return actor?.slug ? permanent(`/${code}/e/${actor.slug}`) : notFound()
    }
    if (rest.length === 1) {
      const [slug = ''] = rest
      const area = await bySlug(payload, 'areas', country.id, slug)
      if (area) {
        // An area with one seat leads to its holder (section 11.2).
        const offices = [...(await officeMap(payload, country.id, locale)).values()].filter(
          ({ office }) => office.areaType === area.type,
        )
        const [only] = offices
        if (offices.length !== 1 || !only) return notFound()
        return (await toHolder(only.office.slug, area.slug ?? slug)) ?? notFound()
      }
      const seat = await toHolder(slug, null)
      if (seat) return seat
      const renamed =
        (await bySlug(payload, 'areas', country.id, slug, true)) ??
        (await bySlug(payload, 'offices', country.id, slug, true))
      return renamed?.slug ? permanent(`/${code}/${renamed.slug}`) : notFound()
    }
    if (rest.length === 2) {
      const [areaSlug = '', officeSlug = ''] = rest
      const area = await current('areas', areaSlug)
      const office = await current('offices', officeSlug)
      if (!area?.slug || !office?.slug) return notFound()
      if (area.slug !== areaSlug || office.slug !== officeSlug) {
        return permanent(`/${code}/${area.slug}/${office.slug}`)
      }
      return (await toHolder(officeSlug, areaSlug)) ?? notFound()
    }
    return notFound()
  },
}

const officeRef = (office: Office) => ({
  slug: office.slug,
  name: office.name,
  shortName: office.shortName,
})

const officeId = (offices: ReadonlyMap<string, OfficeEntry>, slug: string): string =>
  [...offices.values()].find((entry) => entry.office.slug === slug)?.id ?? ''

const badRequest = (param: string): V1Result => ({
  status: 400,
  body: { error: `The ${param} parameter is not one this endpoint accepts.` },
})

/** The public holders of one seat today. */
async function seatHolders(
  payload: Payload,
  country: string,
  locale: TypedLocale,
  seat: { office: { id: string }; area: { id: string } | null },
): Promise<Holder[]> {
  const holders = await holdersBySeat(payload, country, locale, {
    and: [
      { office: { equals: seat.office.id } },
      seat.area ? { area: { equals: seat.area.id } } : { area: { exists: false } },
    ],
  })
  return holders.get(seatKey(seat.office.id, seat.area?.id)) ?? []
}

async function seatHandler(
  payload: Payload,
  code: string,
  locale: TypedLocale,
  officeSlug: string,
  areaSlug: string | null,
): Promise<V1Result> {
  const country = await publishedCountry(payload, code, locale)
  if (isResult(country)) return country
  const seat = await findSeat(payload, country.id, officeSlug, areaSlug)
  if (!seat) return notFound()
  const offices = await officeMap(payload, country.id, locale)
  const entry = offices.get(seat.office.id)
  if (!entry) return notFound()
  const area = seat.area ? (await areaMap(payload, [seat.area.id], locale)).get(seat.area.id) : null
  if (seat.area && !area) return notFound()
  return ok(
    SeatHoldersSchema.parse({
      office: officeRef(entry.office),
      area: area ?? null,
      holdersPerSeat: entry.office.holdersPerSeat,
      holders: await seatHolders(payload, country.id, locale, seat),
    }),
  )
}

/** A path segment decoded, or null when its percent-escapes are malformed, such as `%E0%A4%A`. */
const decode = (part: string): string | null => {
  try {
    return decodeURIComponent(part)
  } catch {
    return null
  }
}

/** Matches `/countries/ke` to `/countries/:code`. Segments are lower case, as addresses are. */
export function matchRoute(
  path: string,
): { pattern: string; params: Record<string, string> } | undefined {
  const parts = path.split('/').filter(Boolean)
  for (const pattern of Object.keys(handlers)) {
    const want = pattern.split('/').filter(Boolean)
    if (want.length !== parts.length) continue
    const params: Record<string, string> = {}
    const matches = want.every((segment, i) => {
      const part = parts[i] ?? ''
      if (segment.startsWith(':')) {
        const value = decode(part)
        if (value === null) return false
        params[segment.slice(1)] = value
        return /^[a-z0-9-]+$/.test(value)
      }
      return segment === part
    })
    if (matches) return { pattern, params }
  }
  return undefined
}

/** Returns `undefined` when no handler matches the path. */
export async function handleV1(
  payload: Payload,
  path: string,
  query: URLSearchParams = new URLSearchParams(),
): Promise<V1Result | undefined> {
  const route = matchRoute(path)
  if (!route) return undefined
  const handler = handlers[route.pattern]
  if (!handler) return undefined
  // Every endpoint answers in one language, which the caller names (section 12.2).
  const locale = query.get('locale') ?? ''
  if (!inUse(locale)) {
    const codes = kernel.locales.map((l) => l.code).join(', ')
    return { status: 400, body: { error: `The locale parameter must be one of ${codes}.` } }
  }
  return handler({ payload, params: route.params, locale, query })
}
