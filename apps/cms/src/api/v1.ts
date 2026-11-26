import {
  convertLexicalToHTML,
  defaultHTMLConverters,
  LinkHTMLConverter,
} from '@payloadcms/richtext-lexical/html'
import type {
  ActorRef,
  ActorSummary,
  Area,
  AreaSummary,
  ArticleSummary,
  ClaimChange,
  ClaimSummary,
  ClaimUpdate,
  Country,
  CountryList,
  CountrySummary,
  Evidence,
  Figures,
  Holder,
  Image,
  Language,
  NotAvailable,
  Office,
  PageSummary,
  PartialDate,
  Partner,
  PlaceResult,
  Rating,
  RatingScale,
  Representative,
  SeatRef,
  SectionId,
  SisterTool,
  SiteInfo,
  Term,
  ThemeSummary,
  TopicSummary,
} from '@promisetracker/contract'
import {
  ActorList as ActorListSchema,
  Actor as ActorSchema,
  AreaList as AreaListSchema,
  Area as AreaSchema,
  ArticleList as ArticleListSchema,
  Article as ArticleSchema,
  ClaimHistory as ClaimHistorySchema,
  ClaimList as ClaimListSchema,
  Claim as ClaimSchema,
  CountryList as CountryListSchema,
  Country as CountrySchema,
  OfficeList as OfficeListSchema,
  Overview as OverviewSchema,
  PAGE_LIMIT,
  Page as PageSchema,
  Redirect as RedirectSchema,
  SECTION_IDS,
  SearchResults as SearchResultsSchema,
  SeatHolders as SeatHoldersSchema,
  SiteInfo as SiteInfoSchema,
  Theme as ThemeSchema,
  TIMELINE_LENGTH,
  TopicList as TopicListSchema,
  Topic as TopicSchema,
  V1_ENDPOINTS,
} from '@promisetracker/contract'
import {
  countryName,
  currentTerms,
  isCountryCode,
  logSearch,
  onRecord,
  partialDatePrecision,
  pastTerms,
  publishedInLocale,
  termStage,
} from '@promisetracker/plugin-core'
import { resolveStrings, sectionField } from '@promisetracker/plugin-site'
import type { Payload, TypedLocale, Where } from 'payload'

import { areaFamily } from '../areaTree'
import { kernel, ownerOf } from '../kernel'
import { registeredLocales } from '../locales'
import type {
  Actor as ActorDoc,
  Area as AreaDoc,
  Article as ArticleDoc,
  Claim as ClaimDoc,
  ClaimUpdate as ClaimUpdateDoc,
  Country as CountryDoc,
  Evidence as EvidenceDoc,
  Media as MediaDoc,
  Office as OfficeDoc,
  Page as PageDoc,
  RatingScale as RatingScaleDoc,
  Site,
  Term as TermDoc,
  Theme as ThemeDoc,
  Topic as TopicDoc,
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

/**
 * A scale in one language. A label not yet translated shows the slug, never
 * another language's text (D30), and a missing definition is left out.
 */
const toRatingScale = (doc: RatingScaleDoc): RatingScale => ({
  id: doc.id,
  name: text(doc.name) ?? doc.id,
  bestValue: doc.bestValue,
  worstValue: doc.worstValue,
  tiers: (doc.tiers ?? []).map((t) => ({
    slug: t.slug,
    label: text(t.label) ?? t.slug,
    colour: t.colour,
  })),
  ratings: (doc.ratings ?? []).map((r) => ({
    slug: r.slug,
    label: text(r.label) ?? r.slug,
    definition: text(r.definition),
    tier: r.tier,
    colour: r.colour,
    textColour: r.textColour,
    value: r.value,
    needsDeadline: r.needsDeadline ?? false,
    isStarting: r.isStarting ?? false,
    retired: r.retired ?? false,
  })),
})

type SiteExtras = Pick<SiteInfo, 'picks' | 'partners' | 'sisterTools'>

/** The sections an editor forced on or off. The rest follow their rule. */
const sectionsOf = (site: Site): SiteInfo['sections'] => {
  const saved = (site.sections ?? {}) as Record<string, unknown>
  const forced: Partial<Record<SectionId, 'on' | 'off'>> = {}
  for (const id of SECTION_IDS) {
    const value = saved[sectionField(id)]
    if (value === 'on' || value === 'off') forced[id] = value
  }
  return forced
}

const toSiteInfo = (
  site: Site,
  scales: readonly RatingScaleDoc[],
  locale: string,
  extras: SiteExtras,
): SiteInfo =>
  SiteInfoSchema.parse({
    ...extras,
    sections: sectionsOf(site),
    name: site.name,
    locale,
    defaultLanguage: kernel.defaultLocale,
    languages: languages(),
    description: text(site.description),
    explainer: text(site.explainer),
    strings: resolveStrings(locale, site.strings),
    navigation: links(site.navigation),
    footer: { about: text(site.footer?.about), links: links(site.footer?.links) },
    ratingScales: scales.map(toRatingScale),
  })

/** A published country always has a name. The standard one covers a gap all the same. */
const nameOf = (doc: CountryDoc, locale: TypedLocale): string =>
  text(doc.name) ?? (isCountryCode(doc.code) ? countryName(doc.code, locale) : doc.code)

const toSummary = (doc: CountryDoc, locale: TypedLocale): CountrySummary => ({
  code: doc.code,
  name: nameOf(doc, locale),
  region: doc.region ?? null,
})

const toCountry = (
  doc: CountryDoc,
  locale: TypedLocale,
  counts: Country['counts'],
  picks: Country['picks'],
): Country =>
  CountrySchema.parse({
    ...toSummary(doc, locale),
    about: text(doc.about),
    defaultLanguage: doc.defaultLanguage ?? null,
    counts,
    picks,
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
    joins: false,
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

/** Every country published in this language. */
async function publishedCountries(payload: Payload, locale: TypedLocale): Promise<CountryDoc[]> {
  const { docs } = await payload.find({
    collection: 'countries',
    joins: false,
    where: publishedInLocale(locale),
    locale,
    sort: 'code',
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

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
    joins: false,
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
    joins: false,
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
    joins: false,
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
    joins: false,
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
  // Counted in the database: a country's past terms grow with its history.
  // A past term's actor is on the record, so being published is enough.
  const { totalDocs } = await payload.count({
    collection: 'terms',
    where: {
      and: [
        { country: { equals: country } },
        pastTerms(),
        { 'actor.publishedIn': { in: [locale] } },
      ],
    },
    overrideAccess: false,
  })
  const articles = await payload.count({
    collection: 'articles',
    where: { and: [{ country: { equals: country } }, publishedInLocale(locale)] },
    overrideAccess: false,
  })
  return { currentHolders: current.size, pastTerms: totalDocs, articles: articles.totalDocs }
}

/** Finds a record by its slug in a country, or by a slug it had before (section 11.2). */
async function bySlug(
  payload: Payload,
  collection: 'areas' | 'offices' | 'actors',
  country: string,
  slug: string,
  former = false,
): Promise<{ id: string; slug?: string | null; areaType?: string | null; type?: string } | null> {
  const { docs } = await payload.find({
    collection,
    joins: false,
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

/** Every rating scale in this language, and each claim type's scale and name. */
type RatingBook = {
  scales: ReadonlyMap<string, RatingScale>
  scaleOfType: ReadonlyMap<string, string>
  types: ReadonlyMap<string, { slug: string; name: string }>
}

async function ratingBook(payload: Payload, locale: TypedLocale): Promise<RatingBook> {
  const [scales, types] = await Promise.all([
    payload.find({
      collection: 'rating-scales',
      locale,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'claim-types',
      locale,
      depth: 0,
      pagination: false,
      overrideAccess: false,
    }),
  ])
  return {
    scales: new Map(scales.docs.map((doc) => [doc.id, toRatingScale(doc)])),
    scaleOfType: new Map(
      types.docs.flatMap((doc) => {
        const scale = idOf(doc.ratingScale)
        return scale ? [[doc.id, scale] as const] : []
      }),
    ),
    types: new Map(
      types.docs.map((doc) => [doc.id, { slug: doc.slug, name: text(doc.name) ?? doc.slug }]),
    ),
  }
}

/** A claim's rating, looked up on its type's scale. */
function ratingOf(
  book: RatingBook,
  claim: ClaimDoc,
): { rating: Rating | null; scale: string | null } {
  const scale = book.scaleOfType.get(idOf(claim.type) ?? '') ?? null
  const rating = scale
    ? (book.scales.get(scale)?.ratings.find((r) => r.slug === claim.currentRating) ?? null)
    : null
  return { rating, scale }
}

/** Below this many claims, figures show as counts (section 10.4). */
async function figuresThreshold(payload: Payload): Promise<number> {
  const site = await payload.findGlobal({ slug: 'site', depth: 0, overrideAccess: false })
  return typeof site.figuresThreshold === 'number' ? site.figuresThreshold : 20
}

/**
 * The figures of a set of claims, in the shape every endpoint shares (section
 * 12.2). Only claims with a rating on their scale count, so the ratings and
 * tiers always add up to the total.
 */
function figuresOf(claims: readonly ClaimDoc[], book: RatingBook, threshold: number): Figures {
  const byRating: Record<string, number> = {}
  const byTier: Record<string, number> = {}
  let total = 0
  for (const claim of claims) {
    const { rating } = ratingOf(book, claim)
    if (!rating) continue
    total += 1
    byRating[rating.slug] = (byRating[rating.slug] ?? 0) + 1
    byTier[rating.tier] = (byTier[rating.tier] ?? 0) + 1
  }
  return { total, form: total >= threshold ? 'percentages' : 'counts', byRating, byTier }
}

const partial = (value: string | null | undefined): PartialDate | null => {
  const precision = partialDatePrecision(value)
  return precision && value ? { value, precision } : null
}

/**
 * Claims a guest may see in this language: those published in it. Their
 * published status folds in their actor, country and checks (section 8.1).
 */
async function publicClaims(
  payload: Payload,
  country: string,
  locale: TypedLocale,
  extra?: Where,
): Promise<ClaimDoc[]> {
  // A claim's published status already folds in its actor and country (section 8.1).
  const { docs } = await payload.find({
    collection: 'claims',
    where: {
      and: [{ country: { equals: country } }, publishedInLocale(locale), ...(extra ? [extra] : [])],
    },
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

type TopicEntry = { doc: TopicDoc; summary: TopicSummary }

/** Every topic with a name in this language, by id. */
async function topicMap(payload: Payload, locale: TypedLocale): Promise<Map<string, TopicEntry>> {
  const { docs } = await payload.find({
    collection: 'topics',
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  const byId = new Map(docs.map((doc) => [doc.id, doc]))
  const entries = docs.flatMap((doc) => {
    const name = text(doc.name)
    if (!name || !doc.slug) return []
    const parentDoc = byId.get(idOf(doc.parent) ?? '')
    const parentName = parentDoc ? text(parentDoc.name) : null
    const summary: TopicSummary = {
      slug: doc.slug,
      name,
      colour: text(doc.colour),
      parent: parentDoc?.slug && parentName ? { slug: parentDoc.slug, name: parentName } : null,
    }
    return [[doc.id, { doc, summary }] as const]
  })
  return new Map(entries)
}

/** A topic's id and the ids of the topics under it, so a broad topic finds every claim. */
const topicAndChildren = (topics: ReadonlyMap<string, TopicEntry>, id: string): string[] => [
  id,
  ...[...topics.values()].filter((t) => idOf(t.doc.parent) === id).map((t) => t.doc.id),
]

const mediaImage = (media: unknown, alt: string, credit: string | null): Image | null => {
  if (!media || typeof media !== 'object') return null
  const { url, alt: own } = media as Pick<MediaDoc, 'url' | 'alt'>
  return url ? { url, alt: text(own) ?? alt, credit } : null
}

function toClaimSummary(
  doc: ClaimDoc,
  code: string,
  actors: ReadonlyMap<string, ActorDoc>,
  topics: ReadonlyMap<string, TopicEntry>,
  book: RatingBook,
): ClaimSummary | null {
  const title = text(doc.title)
  const actor = toActorRef(actors.get(idOf(doc.actor) ?? ''))
  if (!title || !doc.slug || !actor) return null
  const { rating, scale } = ratingOf(book, doc)
  return {
    slug: doc.slug,
    title,
    country: code,
    actor,
    topic: topics.get(idOf(doc.topic) ?? '')?.summary ?? null,
    rating,
    ratingScale: scale,
    saidOn: partial(doc.saidOn),
    deadline: partial(doc.deadline),
    deadlineText: text(doc.deadlineText),
  }
}

/** A claim's published updates in this language, newest first (section 7.6). */
async function publicUpdates(
  payload: Payload,
  claims: readonly string[],
  locale: TypedLocale,
): Promise<ClaimUpdateDoc[]> {
  if (claims.length === 0) return []
  const { docs } = await payload.find({
    collection: 'claim-updates',
    where: { and: [{ claim: { in: claims } }, publishedInLocale(locale)] },
    sort: ['-date', '-createdAt'],
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

const fileUrl = (media: unknown): string | null =>
  media && typeof media === 'object' ? text((media as Pick<MediaDoc, 'url'>).url) : null

const toEvidence = (doc: EvidenceDoc): Evidence => ({
  id: doc.id,
  kind: doc.kind,
  title: doc.title,
  publisher: text(doc.publisher),
  date: partial(doc.date),
  url: text(doc.link) ?? fileUrl(doc.file),
  finding: text(doc.finding),
  thumbnail: mediaImage(doc.thumbnail, doc.title, null),
})

/**
 * The evidence on these updates, by id. Evidence is internal until an update
 * that cites it is published, so only the published updates' evidence is
 * read here, with access checks off.
 */
async function evidenceOf(
  payload: Payload,
  updates: readonly ClaimUpdateDoc[],
  locale: TypedLocale,
): Promise<Map<string, Evidence>> {
  const ids = [...new Set(updates.flatMap((u) => (u.evidence ?? []).map(idOf)))].filter(
    (id): id is string => id !== null,
  )
  if (ids.length === 0) return new Map()
  const { docs } = await payload.find({
    collection: 'evidence',
    where: { id: { in: ids } },
    locale,
    depth: 1,
    pagination: false,
    // Only evidence cited by published updates, collected above.
    overrideAccess: true,
  })
  return new Map(docs.map((doc) => [doc.id, toEvidence(doc)]))
}

/**
 * Each update's kind (section 7.6). Editors choose a correction; otherwise a
 * claim's earliest published update is its first rating, and the rest are
 * changes. Worked out here from the order by date, so adding an older update
 * later relabels the one that was first. Takes updates newest first.
 */
function kindsOf(updates: readonly ClaimUpdateDoc[]): Map<string, ClaimUpdate['kind']> {
  const kinds = new Map<string, ClaimUpdate['kind']>()
  const earliest = new Map<string, string>()
  for (const doc of updates) earliest.set(idOf(doc.claim) ?? '', doc.id)
  for (const doc of updates) {
    kinds.set(
      doc.id,
      doc.kind === 'correction'
        ? 'correction'
        : earliest.get(idOf(doc.claim) ?? '') === doc.id
          ? 'first-rating'
          : 'change',
    )
  }
  return kinds
}

/** An update for the public, with its rating looked up on the claim's scale. */
function toUpdate(
  doc: ClaimUpdateDoc,
  scale: RatingScale | undefined,
  evidence: ReadonlyMap<string, Evidence>,
  kinds: ReadonlyMap<string, ClaimUpdate['kind']>,
): ClaimUpdate | null {
  const date = partial(doc.date)
  const title = text(doc.title)
  if (!date || !title) return null
  return {
    id: doc.id,
    date,
    kind: kinds.get(doc.id) ?? doc.kind ?? 'change',
    rating: scale?.ratings.find((r) => r.slug === doc.rating) ?? null,
    title,
    narrative: text(doc.narrative),
    attribution: text(doc.attribution),
    evidence: (doc.evidence ?? []).flatMap((e) => {
      const found = evidence.get(idOf(e) ?? '')
      return found ? [found] : []
    }),
  }
}

/** The scale a claim is rated on. */
const scaleOf = (book: RatingBook, claim: Pick<ClaimDoc, 'type'>): RatingScale | undefined =>
  book.scales.get(book.scaleOfType.get(idOf(claim.type) ?? '') ?? '')

/**
 * How to cite a claim: its permanent address, under the site's public
 * address when one is set, and when its rating was last reviewed.
 */
async function citationOf(
  payload: Payload,
  locale: TypedLocale,
  claim: ClaimSummary,
  lastReviewedAt: string | null,
): Promise<{ url: string; text: string }> {
  const site = await payload.findGlobal({ slug: 'site', locale, depth: 0, overrideAccess: false })
  const strings = resolveStrings(locale, site.strings)
  const url = `${payload.config.serverURL ?? ''}/${locale}/${claim.country}/p/${claim.slug}`
  const date = lastReviewedAt
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(lastReviewedAt))
    : ''
  const values: Record<string, string> = { title: claim.title, url, date }
  const template = lastReviewedAt ? strings.citeAs : strings.citeAsUnreviewed
  return { url, text: template.replace(/\{(\w+)\}/g, (match, k: string) => values[k] ?? match) }
}

/** How many changes the actor page lists. */
const LATEST_CHANGES = 5

type ClaimOrder = (locale: string) => (a: ClaimDoc, b: ClaimDoc) => number

/** By title, in the reader's language. */
const byTitle: ClaimOrder = (locale) => (a, b) =>
  (a.title ?? '').localeCompare(b.title ?? '', locale)

/** Partial dates are text in date order, so they compare as text. */
const CLAIM_SORTS = {
  /** Newest first by when it was said, then by title. Undated claims go last. */
  recent: (locale) => (a, b) =>
    (b.saidOn ?? '').localeCompare(a.saidOn ?? '') || byTitle(locale)(a, b),
  /** Soonest deadline first. Claims with none go last. */
  deadline: (locale) => (a, b) =>
    (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') || byTitle(locale)(a, b),
  title: byTitle,
} as const satisfies Record<string, ClaimOrder>

/**
 * Actors as they appear in lists: each one's seats today, their party, and
 * the rank of their highest office, for sorting by office.
 */
async function actorSummaries(
  payload: Payload,
  country: string,
  locale: TypedLocale,
  actors: ReadonlyMap<string, ActorDoc>,
  offices: ReadonlyMap<string, OfficeEntry>,
  now: Date,
): Promise<{ items: ActorSummary[]; rank: Map<string, number> }> {
  // Each actor's seats today, and their party.
  const current = (
    await findTerms(payload, country, locale, {
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
    publicActors(country, locale, now, idIn(current.map((t) => idOf(t.party)))),
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
  return { items, rank }
}

// Editorial content (section 7.7)

/** How many articles Latest analysis shows. */
const ANALYSIS_LENGTH = 3

/**
 * Link addresses a reader can safely follow: the web, email, and this site's
 * own. A site path may not start `//` or `/\\`, which browsers read as another site.
 */
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?![/\\])|#)/i

/** A node of an editor's rich text, as Lexical saves it. */
type RichNode = {
  type?: unknown
  fields?: { linkType?: unknown; doc?: { relationTo?: unknown; value?: unknown } }
  relationTo?: unknown
  value?: unknown
  children?: unknown
}

/** What a body's links and images point at, read before it is turned into HTML. */
export type RichRefs = {
  /** A public address for each linked record, by `collection:id`. */
  hrefs: ReadonlyMap<string, string>
  /** Each embedded image's media record, by id. */
  media: ReadonlyMap<string, Record<string, unknown>>
}

const NO_REFS: RichRefs = { hrefs: new Map(), media: new Map() }

const nodesOf = (value: unknown): RichNode[] => {
  if (!value || typeof value !== 'object' || !('root' in value)) return []
  const out: RichNode[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    out.push(node as RichNode)
    const { children } = node as RichNode
    if (Array.isArray(children)) for (const child of children) walk(child)
  }
  walk(value.root)
  return out
}

const refId = (value: unknown): string | null =>
  typeof value === 'string' ? value : (idOf(value as never) ?? null)

/** The record an internal link points at, as `collection:id`. */
const linkKey = (node: RichNode): string | null => {
  const doc = node.fields?.doc
  const id = refId(doc?.value)
  return node.type === 'link' && node.fields?.linkType === 'internal' && id
    ? `${String(doc?.relationTo)}:${id}`
    : null
}

/**
 * Reads what a body's internal links and images point at, as the reader would
 * see them: a record that is not public in this language gets no address, and
 * its link becomes plain text.
 */
export async function richRefs(
  payload: Payload,
  locale: TypedLocale,
  value: unknown,
): Promise<RichRefs> {
  const nodes = nodesOf(value)
  const linked = new Map<string, Set<string>>()
  for (const node of nodes) {
    const key = linkKey(node)
    if (!key) continue
    const [collection = '', id = ''] = key.split(':')
    linked.set(collection, (linked.get(collection) ?? new Set()).add(id))
  }
  const mediaIds = nodes.flatMap((node) => {
    const id = node.type === 'upload' && node.relationTo === 'media' ? refId(node.value) : null
    return id ? [id] : []
  })
  if (!linked.size && !mediaIds.length) return NO_REFS
  const ids = (collection: string) => [...(linked.get(collection) ?? [])]
  const countries = new Map(
    (await publishedCountries(payload, locale)).map((c) => [c.id, c.code] as const),
  )
  const hrefs = new Map<string, string>()
  const inCountry = async (collection: 'actors' | 'articles', letter: string): Promise<void> => {
    const wanted = ids(collection)
    if (!wanted.length) return
    const { docs } = await payload.find({
      collection,
      where: { and: [{ id: { in: wanted } }, publishedInLocale(locale)] },
      depth: 0,
      limit: 0,
      overrideAccess: false,
    })
    for (const doc of docs) {
      const code = countries.get(idOf(doc.country) ?? '')
      if (code && doc.slug)
        hrefs.set(`${collection}:${doc.id}`, `/${locale}/${code}/${letter}/${doc.slug}`)
    }
  }
  const claims = async () => {
    const wanted = ids('claims')
    if (!wanted.length) return
    const { docs } = await payload.find({
      collection: 'claims',
      where: { id: { in: wanted } },
      depth: 0,
      limit: 0,
      select: { country: true },
      overrideAccess: false,
    })
    const byCountry = new Map<string, string[]>()
    for (const doc of docs) {
      const country = idOf(doc.country) ?? ''
      byCountry.set(country, [...(byCountry.get(country) ?? []), doc.id])
    }
    for (const [country, inIt] of byCountry) {
      const code = countries.get(country)
      if (!code) continue
      for (const claim of await publicClaims(payload, country, locale, { id: { in: inIt } })) {
        if (claim.slug) hrefs.set(`claims:${claim.id}`, `/${locale}/${code}/p/${claim.slug}`)
      }
    }
  }
  const global = async (collection: 'themes' | 'pages') => {
    const wanted = ids(collection)
    if (!wanted.length) return
    const { docs } = await payload.find({
      collection,
      where: { and: [{ id: { in: wanted } }, publishedInLocale(locale)] },
      depth: 0,
      limit: 0,
      overrideAccess: false,
    })
    for (const doc of docs) {
      const tail =
        collection === 'themes' ? `themes/${doc.slug ?? ''}` : (Reflect.get(doc, 'path') as unknown)
      if (typeof tail === 'string' && tail && !tail.endsWith('/')) {
        hrefs.set(`${collection}:${doc.id}`, `/${locale}/${tail}`)
      }
    }
  }
  for (const id of ids('countries')) {
    const code = countries.get(id)
    if (code) hrefs.set(`countries:${id}`, `/${locale}/${code}`)
  }
  const [, , , , , found] = await Promise.all([
    inCountry('actors', 'e'),
    inCountry('articles', 'a'),
    claims(),
    global('themes'),
    global('pages'),
    mediaIds.length
      ? payload.find({
          collection: 'media',
          where: { id: { in: mediaIds } },
          depth: 0,
          limit: 0,
          overrideAccess: false,
        })
      : null,
  ])
  const media = new Map(
    (found?.docs ?? []).map((doc) => [doc.id, doc as unknown as Record<string, unknown>] as const),
  )
  return { hrefs, media }
}

/** A copy of the body with each image's media record in place of its id. */
const withMedia = (value: object, media: RichRefs['media']): object => {
  if (!media.size) return value
  const copy = structuredClone(value)
  for (const node of nodesOf(copy)) {
    const id = node.type === 'upload' ? refId(node.value) : null
    const doc = id ? media.get(id) : undefined
    if (doc) node.value = doc
  }
  return copy
}

/**
 * HTML from an editor's rich text. Payload's converter escapes the text it
 * writes. A link to anything but the web, email or this site, such as a
 * `javascript:` address, loses its address. Internal links and images take
 * what `richRefs` read for them; without it they have no address and no image.
 */
export const htmlOf = (value: unknown, refs: RichRefs = NO_REFS): string | null => {
  if (!value || typeof value !== 'object' || !('root' in value)) return null
  const links = LinkHTMLConverter({
    internalDocToHref: ({ linkNode }) => refs.hrefs.get(linkKey(linkNode as RichNode) ?? '') ?? '',
  })
  const html = convertLexicalToHTML({
    data: withMedia(value, refs.media) as never,
    disableContainer: true,
    converters: {
      ...defaultHTMLConverters,
      ...links,
      // A link to a record the reader cannot see is its text alone.
      link: (args) =>
        linkKey(args.node as RichNode) && !refs.hrefs.has(linkKey(args.node as RichNode) ?? '')
          ? args.nodesToHTML({ nodes: args.node.children }).join('')
          : (links.link as (a: typeof args) => string)(args),
    },
  })
    .replace(/\shref="([^"]*)"/g, (whole, href: string) =>
      SAFE_HREF.test(href.trim()) ? whole : ' href="#"',
    )
    .trim()
  return html ? html : null
}

/** A body as the reader sees it: its links and images read, then turned into HTML. */
const bodyHtml = async (payload: Payload, locale: TypedLocale, value: unknown) =>
  htmlOf(value, await richRefs(payload, locale, value))

type AboutKind = ArticleSummary['about']['kind']
const KIND_OF: Record<string, AboutKind> = {
  claims: 'claim',
  actors: 'actor',
  countries: 'country',
}

/**
 * Articles as they appear in lists. An article about a claim or an actor that
 * is not published in this language is left out: its subject is not public.
 */
async function toArticleSummaries(
  payload: Payload,
  country: CountryDoc,
  locale: TypedLocale,
  docs: readonly ArticleDoc[],
): Promise<ArticleSummary[]> {
  const ids = (kind: string) =>
    docs.filter((d) => d.about.relationTo === kind).map((d) => idOf(d.about.value) ?? '')
  const now = new Date()
  const [claims, actors] = await Promise.all([
    ids('claims').length
      ? publicClaims(payload, country.id, locale, { id: { in: ids('claims') } })
      : [],
    ids('actors').length
      ? findActors(payload, publicActors(country.id, locale, now, idIn(ids('actors'))), locale)
      : new Map<string, ActorDoc>(),
  ])
  const claimById = new Map(claims.map((c) => [c.id, c]))
  return docs.flatMap((doc): ArticleSummary[] => {
    const title = text(doc.title)
    const date = day(doc.date)
    const kind = KIND_OF[doc.about.relationTo]
    const id = idOf(doc.about.value) ?? ''
    if (!title || !doc.slug || !date || !kind) return []
    let about: ArticleSummary['about'] | null = null
    if (kind === 'country') about = { kind, slug: country.code, name: nameOf(country, locale) }
    if (kind === 'claim') {
      const claim = claimById.get(id)
      const name = claim ? text(claim.title) : null
      if (claim?.slug && name) about = { kind, slug: claim.slug, name }
    }
    if (kind === 'actor') {
      const ref = toActorRef(actors.get(id))
      if (ref) about = { kind, slug: ref.slug, name: ref.name }
    }
    if (!about) return []
    return [
      {
        slug: doc.slug,
        country: country.code,
        title,
        standfirst: text(doc.standfirst),
        date,
        image: mediaImage(doc.image, title, null),
        // No byline is a normal state, and an editor can hide one (section 7.7).
        byline: doc.hideByline ? null : text(doc.byline),
        about,
      },
    ]
  })
}

/** A country's published articles, the latest first, optionally about one record. */
async function findArticles(
  payload: Payload,
  country: CountryDoc,
  locale: TypedLocale,
  about?: Where,
): Promise<ArticleDoc[]> {
  const { docs } = await payload.find({
    collection: 'articles',
    where: {
      and: [
        { country: { equals: country.id } },
        publishedInLocale(locale),
        ...(about ? [about] : []),
      ],
    },
    sort: ['-date', '-createdAt'],
    locale,
    // The image's address. The subject is matched by id, whatever this populates.
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

const aboutWhere = (collection: string, id: string): Where => ({
  and: [{ 'about.relationTo': { equals: collection } }, { 'about.value': { equals: id } }],
})

/** Latest analysis: the newest articles about one record (section 10.2). */
async function articlesAbout(
  payload: Payload,
  country: CountryDoc,
  locale: TypedLocale,
  collection: 'claims' | 'actors',
  id: string,
): Promise<ArticleSummary[]> {
  const docs = await findArticles(payload, country, locale, aboutWhere(collection, id))
  return (await toArticleSummaries(payload, country, locale, docs)).slice(0, ANALYSIS_LENGTH)
}

/** A theme as it appears in a pick or a list, with the countries it covers that are public. */
async function toThemeSummary(
  payload: Payload,
  doc: ThemeDoc,
  locale: TypedLocale,
): Promise<{ summary: ThemeSummary; countries: CountryDoc[] } | null> {
  const title = text(doc.title)
  if (!title || !doc.slug) return null
  const wanted = (doc.countries ?? []).map(idOf).filter((id): id is string => Boolean(id))
  const countries = (await publishedCountries(payload, locale)).filter((c) => wanted.includes(c.id))
  countries.sort((a, b) => wanted.indexOf(a.id) - wanted.indexOf(b.id))
  return {
    summary: {
      slug: doc.slug,
      title,
      introduction: text(doc.introduction),
      image: mediaImage(doc.image, title, null),
      countries: countries.map((c) => toSummary(c, locale)),
    },
    countries,
  }
}

/** The homepage picks, each only when published in this language (section 10.6). */
async function homePicks(
  payload: Payload,
  site: Site,
  locale: TypedLocale,
): Promise<SiteInfo['picks']> {
  const picks = site.picks ?? {}
  const claimId = idOf(picks.featuredClaim)
  const themeId = idOf(picks.inFocus)
  const areaId = idOf(picks.featuredArea)
  const countries = await publishedCountries(payload, locale)
  const codeOf = (id: unknown) => countries.find((c) => c.id === idOf(id))?.code ?? null
  const [claim, theme, area] = await Promise.all([
    claimId
      ? payload
          .find({
            collection: 'claims',
            where: { and: [{ id: { equals: claimId } }, publishedInLocale(locale)] },
            select: { slug: true, country: true },
            locale,
            depth: 0,
            limit: 1,
            overrideAccess: false,
          })
          .then((r) => r.docs[0])
      : undefined,
    themeId
      ? payload
          .find({
            collection: 'themes',
            where: { and: [{ id: { equals: themeId } }, publishedInLocale(locale)] },
            select: { slug: true },
            locale,
            depth: 0,
            limit: 1,
            overrideAccess: false,
          })
          .then((r) => r.docs[0])
      : undefined,
    areaId
      ? payload
          .find({
            collection: 'areas',
            joins: false,
            where: { and: [{ id: { equals: areaId } }, publishedInLocale(locale)] },
            select: { slug: true, country: true },
            locale,
            depth: 0,
            limit: 1,
            overrideAccess: false,
          })
          .then((r) => r.docs[0])
      : undefined,
  ])
  const claimCountry = claim ? codeOf(claim.country) : null
  const areaCountry = area ? codeOf(area.country) : null
  return {
    featuredClaim: claim?.slug && claimCountry ? { country: claimCountry, slug: claim.slug } : null,
    inFocus: theme?.slug ?? null,
    featuredArea: area?.slug && areaCountry ? { country: areaCountry, slug: area.slug } : null,
  }
}

/** Who we work with, in the editors' order. */
async function partnersOf(payload: Payload): Promise<Partner[]> {
  const { docs } = await payload.find({
    collection: 'partners',
    sort: '_order',
    depth: 1,
    pagination: false,
    overrideAccess: false,
  })
  const codes = new Map(
    (
      await payload.find({
        collection: 'countries',
        joins: false,
        select: { code: true },
        depth: 0,
        pagination: false,
        overrideAccess: false,
      })
    ).docs.map((c): [string, string] => [c.id, c.code]),
  )
  return docs.map((doc) => {
    const logo = mediaImage(doc.logo, doc.name, null)
    return {
      name: doc.name,
      url: doc.url,
      logo: logo ? { url: logo.url, alt: logo.alt } : null,
      countries: (doc.countries ?? [])
        .map((c) => codes.get(idOf(c) ?? ''))
        .filter((code): code is string => Boolean(code)),
    }
  })
}

/** Other tools from PesaCheck, in the editors' order. */
async function sisterToolsOf(payload: Payload, locale: TypedLocale): Promise<SisterTool[]> {
  const { docs } = await payload.find({
    collection: 'sister-tools',
    sort: '_order',
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs.map((doc) => ({ name: doc.name, description: text(doc.description), url: doc.url }))
}

/** The actors and claims an editor picked for a country's In focus, published in this language. */
async function countryPicks(
  payload: Payload,
  country: CountryDoc,
  locale: TypedLocale,
): Promise<Country['picks']> {
  const site = await payload.findGlobal({ slug: 'site', depth: 0, overrideAccess: false })
  const entry = (site.countryPicks ?? []).find((p) => idOf(p.country) === country.id)
  const actorIds = (entry?.actors ?? []).map(idOf).filter((id): id is string => Boolean(id))
  const claimIds = (entry?.claims ?? []).map(idOf).filter((id): id is string => Boolean(id))
  if (actorIds.length === 0 && claimIds.length === 0) return { actors: [], claims: [] }
  const now = new Date()
  const [actors, offices, claims, book, topics] = await Promise.all([
    actorIds.length
      ? findActors(payload, publicActors(country.id, locale, now, idIn(actorIds)), locale)
      : new Map<string, ActorDoc>(),
    officeMap(payload, country.id, locale),
    claimIds.length ? publicClaims(payload, country.id, locale, { id: { in: claimIds } }) : [],
    ratingBook(payload, locale),
    topicMap(payload, locale),
  ])
  const { items } = await actorSummaries(payload, country.id, locale, actors, offices, now)
  const claimActors = await findActors(payload, idIn(claims.map((c) => idOf(c.actor))), locale)
  const summaries = claims
    .map((c) => toClaimSummary(c, country.code, claimActors, topics, book))
    .filter((c): c is ClaimSummary => c !== null)
  // In the editor's order.
  const actorOrder = (slug: string) =>
    actorIds.indexOf([...actors.values()].find((a) => a.slug === slug)?.id ?? '')
  const claimOrder = (slug: string) =>
    claimIds.indexOf(claims.find((c) => c.slug === slug)?.id ?? '')
  return {
    actors: items.sort((a, b) => actorOrder(a.slug) - actorOrder(b.slug)),
    claims: summaries.sort((a, b) => claimOrder(a.slug) - claimOrder(b.slug)),
  }
}

const toPageSummary = (doc: PageDoc): PageSummary | null => {
  const title = text(doc.title)
  return title && doc.path
    ? { title, path: doc.path, summary: text(doc.summary), link: text(doc.link) }
    : null
}

/** Editor pages published in this language at these addresses, keyed by address. */
async function pagesAt(payload: Payload, locale: TypedLocale, where: Where): Promise<PageDoc[]> {
  const { docs } = await payload.find({
    collection: 'pages',
    where: { and: [where, publishedInLocale(locale)] },
    sort: '_order',
    locale,
    depth: 0,
    pagination: false,
    overrideAccess: false,
  })
  return docs
}

/** A list longer than this is sorted in memory with a warning in the log. */
const LARGE_LIST = 2000

const handlers: Record<string, Handler> = {
  '/site': async ({ payload, locale }) => {
    const [site, scales] = await Promise.all([
      payload.findGlobal({ slug: 'site', locale, overrideAccess: false }),
      payload.find({
        collection: 'rating-scales',
        locale,
        sort: 'createdAt',
        depth: 0,
        pagination: false,
        overrideAccess: false,
      }),
    ])
    const [picks, partners, sisterTools] = await Promise.all([
      homePicks(payload, site, locale),
      partnersOf(payload),
      sisterToolsOf(payload, locale),
    ])
    return ok(toSiteInfo(site, scales.docs, locale, { picks, partners, sisterTools }))
  },

  '/countries': async ({ payload, locale }) => {
    const result = await payload.find({
      collection: 'countries',
      joins: false,
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
      joins: false,
      where: { code: { equals: params.code } },
      locale,
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    if ((doc.publishedIn ?? []).includes(locale)) {
      const [counts, picks] = await Promise.all([
        sectionCounts(payload, doc.id, locale),
        countryPicks(payload, doc, locale),
      ])
      return ok(toCountry(doc, locale, counts, picks))
    }
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
        joins: false,
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
      joins: false,
      where: {
        and: [
          { country: { equals: country.id } },
          publishedInLocale(locale),
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
      joins: false,
      where: { and: [{ country: { equals: country.id } }, { slug: { equals: params.area } }] },
      locale: 'all',
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const name = nameIn(doc.name, locale)
    if (!name || !(doc.publishedIn ?? []).includes(locale))
      return notAvailable(doc.publishedIn ?? [])
    const family = await areaFamily(payload, doc.id)
    const above = family.ancestors.length
      ? (
          await payload.find({
            collection: 'areas',
            joins: false,
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
      const found = await bySlug(payload, collection, country.id, slug)
      if (!found) return empty()
      termFilters.push({ [param]: { equals: found.id } })
    }
    const stage = query.get('stage')
    let ids: Set<string> | null = null
    if (stage || termFilters.length > 0) {
      const byStage = stage === 'past' ? pastTerms(now) : currentTerms(now)
      const terms = await findTerms(payload, country.id, locale, {
        and: [byStage, ...termFilters],
      })
      ids = new Set(terms.map((t) => idOf(t.actor) ?? ''))
    }
    const kind = query.get('kind')
    const actors = await findActors(
      payload,
      publicActors(country.id, locale, now, {
        and: [...(ids ? [idIn(ids)] : []), ...(kind ? [{ kind: { equals: kind } }] : [])],
      }),
      locale,
    )
    if (actors.size === 0) return empty()
    if (actors.size > LARGE_LIST) {
      payload.logger.warn(
        `The actor list for ${country.code} sorts ${actors.size} actors in memory. Move the sort into the query.`,
      )
    }

    const { items, rank } = await actorSummaries(payload, country.id, locale, actors, offices, now)
    // Sorted and paged here, not in the database: the order by office needs
    // each actor's highest seat. That suits a country's few hundred office
    // holders. A country tracking thousands of ward seats would need the
    // sort moved into the query.
    const byName = (a: ActorSummary, b: ActorSummary) => a.name.localeCompare(b.name, locale)
    const sort = query.get('sort') ?? 'name'
    items.sort(
      sort === 'office'
        ? (a, b) => (rank.get(a.slug) ?? 0) - (rank.get(b.slug) ?? 0) || byName(a, b)
        : byName,
    )
    const { start, size } = pageOf(query)
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
    // The actor's own claims: the figures of their record, and the key claim.
    const [book, topics, threshold] = await Promise.all([
      ratingBook(payload, locale),
      topicMap(payload, locale),
      figuresThreshold(payload),
    ])
    const claims = await publicClaims(payload, country.id, locale, {
      actor: { equals: actor.id },
    })
    const own = new Map([[actor.id, actor]])
    const key = claims.find((claim) => claim.id === idOf(actor.keyClaim))
    const keySummary = key ? toClaimSummary(key, params.code ?? '', own, topics, book) : null
    const byId = new Map(claims.map((claim) => [claim.id, claim]))
    // Every update, to tell each claim's first rating, of which the latest are shown.
    const all = await publicUpdates(
      payload,
      claims.map((claim) => claim.id),
      locale,
    )
    const kinds = kindsOf(all)
    const recent = all.slice(0, LATEST_CHANGES)
    const recentEvidence = await evidenceOf(payload, recent, locale)
    const latestChanges = recent.flatMap((doc): ClaimChange[] => {
      const claim = byId.get(idOf(doc.claim) ?? '')
      const summary = claim ? toClaimSummary(claim, params.code ?? '', own, topics, book) : null
      const update = claim ? toUpdate(doc, scaleOf(book, claim), recentEvidence, kinds) : null
      return summary && update ? [{ claim: summary, update }] : []
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
        keyClaim: keySummary ? { claim: keySummary, note: text(actor.keyClaimNote) } : null,
        record: figuresOf(claims, book, threshold),
        latestChanges,
        analysis: await articlesAbout(payload, country, locale, 'actors', actor.id),
      }),
    )
  },

  '/countries/:code/claims': async ({ payload, params, locale, query }) => {
    const code = params.code ?? ''
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return country
    const empty = (figures: Figures) =>
      ok(ClaimListSchema.parse({ items: [], total: 0, nextCursor: null, figures }))
    const threshold = await figuresThreshold(payload)
    const [book, topics] = await Promise.all([
      ratingBook(payload, locale),
      topicMap(payload, locale),
    ])
    const none = figuresOf([], book, threshold)

    const filters: Where[] = []
    const actorSlug = query.get('actor')
    if (actorSlug) {
      const actor = await bySlug(payload, 'actors', country.id, actorSlug)
      if (!actor) return empty(none)
      filters.push({ actor: { equals: actor.id } })
    }
    const topicSlug = query.get('topic')
    if (topicSlug) {
      const topic = [...topics.values()].find((t) => t.summary.slug === topicSlug)
      if (!topic) return empty(none)
      filters.push({ topic: { in: topicAndChildren(topics, topic.doc.id) } })
    }
    const typeSlug = query.get('type')
    if (typeSlug) {
      const type = [...book.types].find(([, t]) => t.slug === typeSlug)
      if (!type) return empty(none)
      filters.push({ type: { equals: type[0] } })
    }
    const sort = (query.get('sort') ?? 'recent') as keyof typeof CLAIM_SORTS
    const { start, size } = pageOf(query)

    const rating = query.get('rating')
    const tier = query.get('tier')
    const claims = (
      await publicClaims(payload, country.id, locale, filters.length ? { and: filters } : undefined)
    ).filter((claim) => {
      const found = ratingOf(book, claim).rating
      return (!rating || found?.slug === rating) && (!tier || found?.tier === tier)
    })
    claims.sort(CLAIM_SORTS[sort](locale))
    const page = claims.slice(start, start + size)
    const actors = await findActors(payload, idIn(page.map((c) => idOf(c.actor))), locale)
    const items = page
      .map((c) => toClaimSummary(c, code, actors, topics, book))
      .filter((c): c is ClaimSummary => c !== null)
    const end = start + size
    return ok(
      ClaimListSchema.parse({
        items,
        total: claims.length,
        nextCursor: end < claims.length ? String(end) : null,
        figures: figuresOf(claims, book, threshold),
      }),
    )
  },

  '/countries/:code/claims/:slug': async ({ payload, params, locale }) => {
    const code = params.code ?? ''
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return country
    const { docs } = await payload.find({
      collection: 'claims',
      where: { and: [{ country: { equals: country.id } }, { slug: { equals: params.slug } }] },
      locale,
      depth: 1,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const published = doc.publishedIn ?? []
    if (!published.includes(locale)) {
      return notAvailable(published.filter((l) => (country.publishedIn ?? []).includes(l)))
    }
    const now = new Date()
    const people = await findActors(
      payload,
      publicActors(
        country.id,
        locale,
        now,
        idIn([idOf(doc.actor), ...(doc.coActors ?? []).map(idOf)]),
      ),
      locale,
    )
    const [book, topics] = await Promise.all([
      ratingBook(payload, locale),
      topicMap(payload, locale),
    ])
    // The claim is read with its relationships filled in, so it is read again
    // without them for the summary, which compares ids.
    const flat: ClaimDoc = {
      ...doc,
      actor: idOf(doc.actor) ?? '',
      topic: idOf(doc.topic),
      type: idOf(doc.type),
    }
    const summary = toClaimSummary(flat, code, people, topics, book)
    if (!summary) return notFound()
    const term = doc.term && typeof doc.term === 'object' ? doc.term : null
    const offices = term
      ? await officeMap(payload, country.id, locale)
      : new Map<string, OfficeEntry>()
    const seatOffice = term ? offices.get(idOf(term.office) ?? '') : undefined
    const areaIds = [idOf(doc.area), term ? idOf(term.area) : null].filter(
      (id): id is string => id !== null,
    )
    const areas = await areaMap(payload, areaIds, locale)
    const typeId = idOf(doc.type)
    const updates = await publicUpdates(payload, [doc.id], locale)
    const evidence = await evidenceOf(payload, updates, locale)
    const scale = scaleOf(book, flat)
    const kinds = kindsOf(updates)
    const timeline = updates
      .map((u) => toUpdate(u, scale, evidence, kinds))
      .filter((u): u is ClaimUpdate => u !== null)
    const cited = [...new Map(timeline.flatMap((u) => u.evidence).map((e) => [e.id, e])).values()]
    const lastReviewedAt = day(doc.lastReviewedAt)
    return ok(
      ClaimSchema.parse({
        ...summary,
        statement: text(doc.statement),
        summary: text(doc.summary),
        type: typeId ? (book.types.get(typeId) ?? null) : null,
        coActors: (doc.coActors ?? [])
          .map((co) => toActorRef(people.get(idOf(co) ?? '')))
          .filter((ref): ref is ActorRef => ref !== null),
        seat: seatOffice
          ? {
              office: officeRef(seatOffice.office),
              area: term ? (areas.get(idOf(term.area) ?? '') ?? null) : null,
            }
          : null,
        area: areas.get(idOf(doc.area) ?? '') ?? null,
        saidAt: text(doc.saidAt),
        sourceUrl: text(doc.sourceUrl),
        sourceLocator: text(doc.sourceLocator),
        ratedOn: day(doc.ratedOn),
        lastReviewedAt,
        image: mediaImage(doc.image, summary.title, text(doc.imageCredit)),
        // Who verified it stays internal (section 13).
        verification: {
          date: day(doc.verification?.date),
          rationale: text(doc.verification?.rationale),
          reportUrl: text(doc.verification?.reportUrl),
        },
        updateCount: timeline.length,
        timeline: timeline.slice(0, TIMELINE_LENGTH),
        evidence: cited,
        citation: await citationOf(payload, locale, summary, lastReviewedAt),
        analysis: await articlesAbout(payload, country, locale, 'claims', doc.id),
      }),
    )
  },

  '/countries/:code/claims/:slug/history': async ({ payload, params, locale }) => {
    const code = params.code ?? ''
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return country
    const { docs } = await payload.find({
      collection: 'claims',
      where: { and: [{ country: { equals: country.id } }, { slug: { equals: params.slug } }] },
      locale,
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const published = doc.publishedIn ?? []
    if (!published.includes(locale)) {
      return notAvailable(published.filter((l) => (country.publishedIn ?? []).includes(l)))
    }
    const [people, book, topics] = await Promise.all([
      findActors(
        payload,
        publicActors(country.id, locale, new Date(), idIn([idOf(doc.actor)])),
        locale,
      ),
      ratingBook(payload, locale),
      topicMap(payload, locale),
    ])
    const summary = toClaimSummary(doc, code, people, topics, book)
    if (!summary) return notFound()
    const updates = await publicUpdates(payload, [doc.id], locale)
    const evidence = await evidenceOf(payload, updates, locale)
    const scale = scaleOf(book, doc)
    const kinds = kindsOf(updates)
    return ok(
      ClaimHistorySchema.parse({
        claim: summary,
        lastReviewedAt: day(doc.lastReviewedAt),
        updates: updates
          .map((u) => toUpdate(u, scale, evidence, kinds))
          .filter((u): u is ClaimUpdate => u !== null),
      }),
    )
  },

  '/topics': async ({ payload, locale }) => {
    const topics = await topicMap(payload, locale)
    const counts = new Map<string, number>()
    // Each country's claims load at once. Worth revisiting past a few
    // thousand claims across countries (D57).
    const perCountry = await Promise.all(
      (await publishedCountries(payload, locale)).map((country) =>
        publicClaims(payload, country.id, locale),
      ),
    )
    for (const claims of perCountry) {
      for (const claim of claims) {
        const topic = topics.get(idOf(claim.topic) ?? '')
        if (!topic) continue
        // A claim counts for its topic and for the broader one above it.
        for (const id of [topic.doc.id, idOf(topic.doc.parent)]) {
          if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
        }
      }
    }
    const items = [...topics.values()]
      .map(({ doc, summary }) => ({ ...summary, claims: counts.get(doc.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name, locale))
    return ok(TopicListSchema.parse({ items }))
  },

  '/topics/:slug': async ({ payload, params, locale }) => {
    const { docs } = await payload.find({
      collection: 'topics',
      where: { slug: { equals: params.slug } },
      locale: 'all',
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [found] = docs
    if (!found) return notFound()
    if (!nameIn(found.name, locale)) {
      return notAvailable(kernel.locales.map((l) => l.code).filter((l) => nameIn(found.name, l)))
    }
    const topics = await topicMap(payload, locale)
    const topic = topics.get(found.id)
    if (!topic) return notFound()
    const ids = topicAndChildren(topics, found.id)
    const threshold = await figuresThreshold(payload)
    const book = await ratingBook(payload, locale)
    const countries: { country: CountrySummary; figures: Figures }[] = []
    const published = await publishedCountries(payload, locale)
    const perCountry = await Promise.all(
      published.map((country) => publicClaims(payload, country.id, locale, { topic: { in: ids } })),
    )
    published.forEach((country, i) => {
      const claims = perCountry[i] ?? []
      if (claims.length > 0) {
        countries.push({
          country: toSummary(country, locale),
          figures: figuresOf(claims, book, threshold),
        })
      }
    })
    return ok(
      TopicSchema.parse({
        ...topic.summary,
        description: text(topic.doc.description),
        children: ids.slice(1).flatMap((id) => {
          const child = topics.get(id)
          return child ? [child.summary] : []
        }),
        countries,
      }),
    )
  },

  '/countries/:code/articles': async ({ payload, params, locale, query }) => {
    const code = params.code ?? ''
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return country
    const empty = () => ok(ArticleListSchema.parse({ items: [], total: 0, nextCursor: null }))
    // The contract has checked its form: `country`, or `claim:` or `actor:` and a slug.
    const about = query.get('about')
    let where: Where | undefined
    if (about === 'country') where = aboutWhere('countries', country.id)
    else if (about) {
      const [kind = '', slug = ''] = about.split(':')
      const collection = kind === 'claim' ? 'claims' : 'actors'
      const { docs } = await payload.find({
        collection,
        where: { and: [{ country: { equals: country.id } }, { slug: { equals: slug } }] },
        select: { slug: true },
        depth: 0,
        limit: 1,
        overrideAccess: false,
      })
      const [found] = docs
      if (!found) return empty()
      where = aboutWhere(collection, found.id)
    }
    const items = await toArticleSummaries(
      payload,
      country,
      locale,
      await findArticles(payload, country, locale, where),
    )
    const { start, size } = pageOf(query)
    const end = start + size
    return ok(
      ArticleListSchema.parse({
        items: items.slice(start, end),
        total: items.length,
        nextCursor: end < items.length ? String(end) : null,
      }),
    )
  },

  '/countries/:code/articles/:slug': async ({ payload, params, locale }) => {
    const code = params.code ?? ''
    const country = await publishedCountry(payload, code, locale)
    if (isResult(country)) return country
    const { docs } = await payload.find({
      collection: 'articles',
      where: { and: [{ country: { equals: country.id } }, { slug: { equals: params.slug } }] },
      locale,
      depth: 1,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const published = doc.publishedIn ?? []
    if (!published.includes(locale)) {
      return notAvailable(published.filter((l) => (country.publishedIn ?? []).includes(l)))
    }
    const [summary] = await toArticleSummaries(payload, country, locale, [doc])
    if (!summary) return notFound()
    return ok(ArticleSchema.parse({ ...summary, body: await bodyHtml(payload, locale, doc.body) }))
  },

  '/themes/:slug': async ({ payload, params, locale }) => {
    const { docs } = await payload.find({
      collection: 'themes',
      where: { slug: { equals: params.slug } },
      locale,
      depth: 1,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const published = doc.publishedIn ?? []
    if (!published.includes(locale)) return notAvailable(published)
    const theme = await toThemeSummary(payload, doc, locale)
    if (!theme) return notFound()
    const wanted = (doc.claims ?? []).map(idOf).filter((id): id is string => Boolean(id))
    const [book, topics, threshold] = await Promise.all([
      ratingBook(payload, locale),
      topicMap(payload, locale),
      figuresThreshold(payload),
    ])
    const perCountry = await Promise.all(
      theme.countries.map((c) =>
        wanted.length ? publicClaims(payload, c.id, locale, { id: { in: wanted } }) : [],
      ),
    )
    const all = perCountry.flat()
    const actors = await findActors(payload, idIn(all.map((c) => idOf(c.actor))), locale)
    const codeOf = new Map(theme.countries.map((c) => [c.id, c.code]))
    const claims = all
      .sort((a, b) => wanted.indexOf(a.id) - wanted.indexOf(b.id))
      .map((c) => toClaimSummary(c, codeOf.get(idOf(c.country) ?? '') ?? '', actors, topics, book))
      .filter((c): c is ClaimSummary => c !== null)
    return ok(
      ThemeSchema.parse({
        ...theme.summary,
        claims,
        figures: theme.countries.flatMap((country, i) => {
          const own = perCountry[i] ?? []
          return own.length
            ? [{ country: toSummary(country, locale), figures: figuresOf(own, book, threshold) }]
            : []
        }),
      }),
    )
  },

  '/pages': async ({ payload, locale, query }) => {
    // The contract has checked its form: slugs joined by slashes.
    const path = query.get('path') ?? ''
    const { docs } = await payload.find({
      collection: 'pages',
      where: { path: { equals: path } },
      locale,
      depth: 0,
      limit: 1,
      overrideAccess: false,
    })
    const [doc] = docs
    if (!doc) return notFound()
    const published = doc.publishedIn ?? []
    if (!published.includes(locale)) return notAvailable(published)
    const page = toPageSummary(doc)
    if (!page) return notFound()
    const parts = path.split('/')
    const above = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join('/'))
    const [parents, children] = await Promise.all([
      above.length ? pagesAt(payload, locale, { path: { in: above } }) : [],
      pagesAt(payload, locale, { parent: { equals: doc.id } }),
    ])
    const summaries = (list: readonly PageDoc[]) =>
      list.map(toPageSummary).filter((p): p is PageSummary => p !== null)
    return ok(
      PageSchema.parse({
        ...page,
        body: page.link ? null : await bodyHtml(payload, locale, doc.body),
        parents: summaries(parents).sort((a, b) => a.path.length - b.path.length),
        children: summaries(children),
      }),
    )
  },

  '/overview': async ({ payload, locale }) => {
    const countries = await publishedCountries(payload, locale)
    const [book, threshold] = await Promise.all([
      ratingBook(payload, locale),
      figuresThreshold(payload),
    ])
    const claims = (
      await Promise.all(countries.map((c) => publicClaims(payload, c.id, locale)))
    ).flat()
    const actors = new Set(claims.map((c) => idOf(c.actor)).filter(Boolean))
    const updates = await publicUpdates(
      payload,
      claims.map((c) => c.id),
      locale,
    )
    const sources = new Set(updates.flatMap((u) => (u.evidence ?? []).map((e) => idOf(e))))
    sources.delete(null)
    return ok(
      OverviewSchema.parse({
        figures: figuresOf(claims, book, threshold),
        actors: actors.size,
        countries: countries.length,
        sources: sources.size,
      }),
    )
  },

  '/search': async ({ payload, locale, query }) => {
    // The contract has checked both: q is 2 to 100 characters, country a code.
    const q = (query.get('q') ?? '').trim()
    const code = query.get('country') ?? undefined
    if (code) {
      const country = await publishedCountry(payload, code, locale)
      if (isResult(country)) return country
    }
    const search = kernel.adapters.search
    const ctx = await kernel.context(payload, ownerOf(search))
    const scope = { locale, ...(code ? { country: code } : {}) }
    const [found, matches] = await Promise.all([
      search.search(q, scope, ctx),
      search.resolvePlace(q, scope, ctx),
    ])
    const now = new Date()
    const places = (
      await Promise.all(matches.map((match) => placeOf(payload, locale, match.id, now)))
    ).filter((place): place is PlaceResult => place !== null)
    const items = (kind: 'actor' | 'claim' | 'topic') =>
      (found.groups.find((group) => group.kind === kind)?.items ?? []).map(
        ({ title, url, country }) => ({ title, url, country }),
      )
    const actors = items('actor')
    const claims = items('claim')
    const topics = items('topic')
    const total = places.length + actors.length + claims.length + topics.length
    const body = SearchResultsSchema.parse({ query: q, places, actors, claims, topics, total })
    // Logged after the answer, so the log never slows a search down.
    // recordSearch catches its own errors.
    void recordSearch(payload, { query: q, locale, country: code ?? null, results: total })
    return ok(body)
  },

  '/redirects': async ({ payload, locale, query }) => {
    const parts = (query.get('path') ?? '').split('/').filter(Boolean)
    const [code = '', ...rest] = parts
    if (!rest.every((part) => SLUG.test(part))) return notFound()
    // A renamed theme: themes sit outside any country (section 11.2).
    if (code === 'themes' && rest.length === 1) {
      const { docs } = await payload.find({
        collection: 'themes',
        where: { formerSlugs: { in: [rest[0] ?? ''] } },
        depth: 0,
        limit: 1,
        overrideAccess: false,
      })
      const slug = docs[0]?.slug
      return slug
        ? ok(RedirectSchema.parse({ to: `/themes/${slug}`, permanent: true }))
        : notFound()
    }
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

    // A claim's page, or its history page (section 11.1).
    const history = rest.length === 3 && rest[2] === 'history'
    if (rest[0] === 'p' && (rest.length === 2 || history)) {
      const { docs } = await payload.find({
        collection: 'claims',
        where: {
          and: [{ country: { equals: country.id } }, { formerSlugs: { in: [rest[1] ?? ''] } }],
        },
        depth: 0,
        limit: 1,
        overrideAccess: false,
      })
      const slug = docs[0]?.slug
      return slug ? permanent(`/${code}/p/${slug}${history ? '/history' : ''}`) : notFound()
    }
    if (rest[0] === 'a' && rest.length === 2) {
      const { docs } = await payload.find({
        collection: 'articles',
        where: {
          and: [{ country: { equals: country.id } }, { formerSlugs: { in: [rest[1] ?? ''] } }],
        },
        depth: 0,
        limit: 1,
        overrideAccess: false,
      })
      const slug = docs[0]?.slug
      return slug ? permanent(`/${code}/a/${slug}`) : notFound()
    }
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
      // A current address wins over a former slug: a national office keeps
      // its own address even when an area once had the same slug.
      if (await findSeat(payload, country.id, slug, null)) {
        return (await toHolder(slug, null)) ?? notFound()
      }
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

const badRequest = (error: string): V1Result => ({ status: 400, body: { error } })

/** Where a page starts and how long it is. The values were checked against the contract. */
const pageOf = (query: URLSearchParams) => ({
  start: Number(query.get('cursor') ?? '0'),
  size: Number(query.get('limit') ?? PAGE_LIMIT.default),
})

/** Each handler's query schema, from the contract's endpoint table. */
const QUERIES = new Map(
  V1_ENDPOINTS.map((e) => [e.path.replace(/\{(\w+)\}/g, ':$1'), e.query] as const),
)

/**
 * Checks the query against the endpoint's schema in the contract (section
 * 12.2): every parameter known, once, and of the right form. Returns the
 * problem, or null.
 */
function checkQuery(pattern: string, query: URLSearchParams): V1Result | null {
  const keys = [...new Set(query.keys())]
  const repeated = keys.find((key) => query.getAll(key).length > 1)
  if (repeated) return badRequest(`The ${repeated} parameter is given more than once.`)
  const schema = QUERIES.get(pattern)
  if (!schema) return badRequest('This endpoint has no parameters in the contract.')
  const result = schema.safeParse(Object.fromEntries(query))
  if (!result.success) {
    const [issue] = result.error.issues
    if (issue?.code === 'unrecognized_keys') {
      return badRequest(`This endpoint takes no ${issue.keys[0]} parameter.`)
    }
    const param = String(issue?.path[0] ?? 'locale')
    if (param === 'locale') return localeError()
    return badRequest(`The ${param} parameter is not one this endpoint accepts.`)
  }
  return null
}

const localeError = () =>
  badRequest(`The locale parameter must be one of ${kernel.locales.map((l) => l.code).join(', ')}.`)

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

/**
 * A place that matched a search, with every seat that answers for it today,
 * from the top down: national seats, the areas above it, the place itself,
 * then the areas inside it (section 7.11). A whole country lists only its
 * national seats, since everything is inside it.
 */
async function placeOf(
  payload: Payload,
  locale: TypedLocale,
  id: string,
  now: Date,
): Promise<PlaceResult | null> {
  const { docs } = await payload.find({
    collection: 'areas',
    joins: false,
    where: { and: [{ id: { equals: id } }, publishedInLocale(locale)] },
    locale,
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const [doc] = docs
  const area = doc ? toAreaSummary(doc) : null
  const countryId = doc ? idOf(doc.country) : null
  if (!doc || !area || !countryId) return null
  const { docs: countries } = await payload.find({
    collection: 'countries',
    joins: false,
    where: { and: [{ id: { equals: countryId } }, publishedInLocale(locale)] },
    locale,
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const code = countries[0]?.code
  if (!code) return null
  const family = await areaFamily(payload, doc.id)
  const above = [...family.ancestors].reverse()
  const below = doc.type === 'country' ? [] : family.descendants
  // National seats first, then the areas above, the country first, then this
  // place, then everything inside it.
  const rank = new Map<string, number>([
    ...above.map((areaId, i) => [areaId, i + 1] as const),
    [doc.id, above.length + 1],
    ...below.map((areaId) => [areaId, above.length + 2] as const),
  ])
  const ids = [...rank.keys()]
  const [holders, offices, areas] = await Promise.all([
    holdersBySeat(
      payload,
      countryId,
      locale,
      { or: [{ area: { in: ids } }, { area: { exists: false } }] },
      now,
    ),
    officeMap(payload, countryId, locale),
    areaMap(payload, ids, locale),
  ])
  const seats = [...holders.entries()].flatMap(([key, list]) => {
    const [officeKey = '', areaKey = ''] = key.split('|')
    const entry = offices.get(officeKey)
    const seatArea = areaKey ? areas.get(areaKey) : null
    if (!entry || seatArea === undefined) return []
    const seat: Representative = { office: officeRef(entry.office), area: seatArea, holders: list }
    return [{ seat, rank: areaKey ? (rank.get(areaKey) ?? ids.length) : 0, order: entry.order }]
  })
  seats.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.order - b.order ||
      (a.seat.area?.name ?? '').localeCompare(b.seat.area?.name ?? ''),
  )
  // Seats inside a large place, such as a region with thousands of wards, are
  // cut first: the list is in order, top first (D84).
  return {
    country: code,
    area,
    representatives: seats.slice(0, MAX_REPRESENTATIVES).map((s) => s.seat),
  }
}

/** The most seats a place lists. A county with every constituency fits well within it. */
const MAX_REPRESENTATIVES = 60

/**
 * Logs a search (section 18) and tells the analytics port. A search is
 * answered even if either fails, so a failure goes to the log only.
 */
async function recordSearch(
  payload: Payload,
  search: { query: string; locale: string; country: string | null; results: number },
): Promise<void> {
  try {
    await logSearch(payload, search)
    const analytics = kernel.adapters.analytics
    await analytics.searchEvent(
      {
        query: search.query,
        locale: search.locale,
        ...(search.country ? { country: search.country } : {}),
        resultCount: search.results,
      },
      await kernel.context(payload, ownerOf(analytics)),
    )
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Could not log a search' })
  }
}

/** Every path the handlers answer, such as `/countries/:code`. */
export const V1_PATTERNS: readonly string[] = Object.keys(handlers)

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
  const problem = checkQuery(route.pattern, query)
  if (problem) return problem
  // Every endpoint answers in one language, which the caller names (section 12.2).
  const locale = query.get('locale') ?? ''
  if (!inUse(locale)) return localeError()
  return handler({ payload, params: route.params, locale, query })
}
