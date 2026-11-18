import type {
  Area,
  AreaSummary,
  Country,
  CountryList,
  CountrySummary,
  Language,
  NotAvailable,
  Office,
  SiteInfo,
} from '@promisetracker/contract'
import {
  AreaList as AreaListSchema,
  Area as AreaSchema,
  CountryList as CountryListSchema,
  Country as CountrySchema,
  OfficeList as OfficeListSchema,
  SiteInfo as SiteInfoSchema,
} from '@promisetracker/contract'
import { countryName, isCountryCode, publishedInLocale } from '@promisetracker/plugin-core'
import { resolveStrings } from '@promisetracker/plugin-site'
import type { Payload, TypedLocale } from 'payload'

import { areaFamily } from '../areaTree'
import { kernel } from '../kernel'
import { registeredLocales } from '../locales'
import type {
  Area as AreaDoc,
  Country as CountryDoc,
  Office as OfficeDoc,
  Site,
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

const toCountry = (doc: CountryDoc, locale: TypedLocale): Country =>
  CountrySchema.parse({
    ...toSummary(doc, locale),
    about: text(doc.about),
    defaultLanguage: doc.defaultLanguage ?? null,
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
  if (!name) return null
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
  return name ? { slug: doc.slug, name, type: doc.type } : null
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
    if ((doc.publishedIn ?? []).includes(locale)) return ok(toCountry(doc, locale))
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
    const seats = (await officesOf(payload, country.id, locale))
      .filter((office) => office.areaType === doc.type)
      .map((office) => ({
        office: { slug: office.slug, name: office.name, shortName: office.shortName },
        holdersPerSeat: office.holdersPerSeat,
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
