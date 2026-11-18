import type {
  Country,
  CountryList,
  CountrySummary,
  Language,
  NotAvailable,
  SiteInfo,
} from '@promisetracker/contract'
import {
  CountryList as CountryListSchema,
  Country as CountrySchema,
  SiteInfo as SiteInfoSchema,
} from '@promisetracker/contract'
import { countryName, isCountryCode, publishedInLocale } from '@promisetracker/plugin-core'
import { resolveStrings } from '@promisetracker/plugin-site'
import type { Payload, TypedLocale } from 'payload'

import { kernel } from '../kernel'
import { registeredLocales } from '../locales'
import type { Country as CountryDoc, Site } from '../payload-types'

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
  (items ?? []).flatMap((item) =>
    text(item.label) && text(item.url)
      ? [{ label: item.label as string, url: item.url as string }]
      : [],
  )

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

type Context = { payload: Payload; params: Record<string, string>; locale: TypedLocale }

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
        params[segment.slice(1)] = decodeURIComponent(part)
        return /^[a-z0-9-]+$/.test(params[segment.slice(1)] ?? '')
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
  return handler({ payload, params: route.params, locale })
}
