import 'server-only'

import type { CountrySummary, SiteInfo } from '@promisetracker/contract'
import type { ActorQuery, ClaimQuery, SearchScope } from '@promisetracker/sdk'
import { BadRequestError, isNotAvailable, NotFoundError } from '@promisetracker/sdk'
import { unstable_cache } from 'next/cache'
import { notFound, permanentRedirect, redirect } from 'next/navigation'

import { sdk } from '@/platform/sdk'

/**
 * The site's reads, cached by tag (section 17). A change in the admin
 * refreshes the tags it touches at once, through the internal revalidate
 * route. Reads that name office holders also expire hourly: a term starts or
 * ends on its date, with no edit to refresh it.
 */

/** Always on (D45), so it is safe when the address names no language the site runs in. */
export const DEFAULT_LOCALE = 'en'

export const LOGO = '/images/promisetracker-logo.png'

/**
 * The data cache lives on disk and outlasts a restart. A restart can change
 * the platform's settings, such as the languages in PT_LOCALES, so every entry
 * belongs to one run of the server and a new run starts empty.
 */
const RUN = crypto.randomUUID()

export const getSite = (locale: string) =>
  unstable_cache(() => sdk.getSiteInfo(locale), [RUN, 'site', locale], { tags: ['site'] })()

export const getCountries = (locale: string) =>
  unstable_cache(() => sdk.getCountries(locale), [RUN, 'countries', locale], {
    tags: ['countries'],
  })()

/** How long a read that names office holders is kept, in seconds. */
const HOLDERS_TTL = 3600

/**
 * The tags of every read about a country's people, places and claims. An
 * actor's page shows their claims, and a claim names its actor, so they share
 * them. Figures also depend on the rating scales and the threshold in Settings.
 */
const peopleTags = (code: string) => [
  `actors:${code}`,
  `places:${code}`,
  `country:${code}`,
  `claims:${code}`,
  'topics',
  'ratings',
  'site',
]

/** A country's areas and offices change together, so they share one tag. */
export const getArea = (locale: string, code: string, area: string) =>
  unstable_cache(() => sdk.getArea(locale, code, area), [RUN, 'area', locale, code, area], {
    tags: peopleTags(code),
    revalidate: HOLDERS_TTL,
  })()

/** The country, and the counts its sections need. */
export const getCountry = (locale: string, code: string) =>
  unstable_cache(() => sdk.getCountry(locale, code), [RUN, 'country', locale, code], {
    tags: peopleTags(code),
    revalidate: HOLDERS_TTL,
  })()

export const getOffices = (locale: string, code: string) =>
  unstable_cache(() => sdk.getOffices(locale, code), [RUN, 'offices', locale, code], {
    tags: [`places:${code}`, `country:${code}`],
  })()

export const getSeat = (locale: string, code: string, office: string, area?: string) =>
  unstable_cache(
    () => sdk.getSeat(locale, code, office, area),
    [RUN, 'seat', locale, code, office, area ?? ''],
    { tags: peopleTags(code), revalidate: HOLDERS_TTL },
  )()

export const getActors = (locale: string, code: string, query: ActorQuery = {}) =>
  unstable_cache(
    () => sdk.getActors(locale, code, query),
    [RUN, 'actors', locale, code, JSON.stringify(query)],
    { tags: peopleTags(code), revalidate: HOLDERS_TTL },
  )()

/** Every actor a query matches, following each page. For filter choices, not for display. */
export async function getAllActors(locale: string, code: string, query: ActorQuery = {}) {
  const items = []
  let cursor: string | undefined
  do {
    const page = await getActors(locale, code, { ...query, limit: 100, cursor })
    items.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return items
}

export const getActor = (locale: string, code: string, slug: string) =>
  unstable_cache(() => sdk.getActor(locale, code, slug), [RUN, 'actor', locale, code, slug], {
    tags: peopleTags(code),
    revalidate: HOLDERS_TTL,
  })()

export const getClaims = (locale: string, code: string, query: ClaimQuery = {}) =>
  unstable_cache(
    () => sdk.getClaims(locale, code, query),
    [RUN, 'claims', locale, code, JSON.stringify(query)],
    { tags: peopleTags(code), revalidate: HOLDERS_TTL },
  )()

export const getClaim = (locale: string, code: string, slug: string) =>
  unstable_cache(() => sdk.getClaim(locale, code, slug), [RUN, 'claim', locale, code, slug], {
    tags: peopleTags(code),
    revalidate: HOLDERS_TTL,
  })()

export const getClaimHistory = (locale: string, code: string, slug: string) =>
  unstable_cache(
    () => sdk.getClaimHistory(locale, code, slug),
    [RUN, 'claim-history', locale, code, slug],
    { tags: peopleTags(code), revalidate: HOLDERS_TTL },
  )()

/** Topics span every country, so any country's change can move their figures. */
const topicTags = ['topics', 'countries', 'ratings', 'site']

export const getTopics = (locale: string) =>
  unstable_cache(() => sdk.getTopics(locale), [RUN, 'topics', locale], {
    tags: topicTags,
    revalidate: HOLDERS_TTL,
  })()

export const getTopic = (locale: string, slug: string) =>
  unstable_cache(() => sdk.getTopic(locale, slug), [RUN, 'topic', locale, slug], {
    tags: topicTags,
    revalidate: HOLDERS_TTL,
  })()

/**
 * A search. Not cached: each one is logged (section 18), and few are asked
 * twice. A country the site does not have in this language searches every
 * country instead.
 */
export async function search(locale: string, q: string, scope: SearchScope = {}) {
  if (scope.country) {
    const found = await orNull(sdk.search(locale, q, scope))
    if (found && !isNotAvailable(found)) return found
  }
  const everywhere = await orNotFound(sdk.search(locale, q))
  if (isNotAvailable(everywhere)) notFound()
  return everywhere
}

/** Where an address leads instead (section 11.2). The path has no language. */
export const getRedirect = (locale: string, path: string) => {
  const [, code = ''] = path.split('/')
  return unstable_cache(() => sdk.getRedirect(locale, path), [RUN, 'redirect', locale, path], {
    tags: peopleTags(code),
    revalidate: HOLDERS_TTL,
  })()
}

/**
 * Sends the reader on if the address leads elsewhere: permanently for a
 * renamed slug, for now for a seat with one holder (section 11.2).
 */
export async function followRedirect(locale: string, path: string): Promise<void> {
  const found = await orNotFound(getRedirect(locale, path))
  if (!found) return
  const to = `/${locale}${found.to}`
  if (found.permanent) permanentRedirect(to)
  redirect(to)
}

/**
 * A read, or the not-found page when there is nothing at this address: a
 * record that does not exist, or a language the site does not run in.
 */
export async function orNotFound<T>(read: Promise<T>): Promise<T> {
  try {
    return await read
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof BadRequestError) notFound()
    throw error
  }
}

/**
 * A read, or null when there is nothing at this address, so the page can try
 * what else the address might be. A language the site does not run in is
 * still the not-found page.
 */
export async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read
  } catch (error) {
    if (error instanceof NotFoundError) return null
    if (error instanceof BadRequestError) notFound()
    throw error
  }
}

/** The site in this language, or null when the site does not run in it. */
export async function findSite(locale: string): Promise<SiteInfo | null> {
  try {
    return await getSite(locale)
  } catch (error) {
    if (error instanceof BadRequestError) return null
    throw error
  }
}

/** What every page needs, or the not-found page when the language is not one the site runs in. */
export async function loadShell(
  locale: string,
): Promise<{ site: SiteInfo; countries: readonly CountrySummary[] }> {
  const site = await findSite(locale)
  if (!site) notFound()
  const { items } = await orNotFound(getCountries(locale))
  return { site, countries: items }
}

/** Confirms a newsletter sign-up. Never cached: each link works once. */
export const confirmSubscription = (token: string) => sdk.confirmSubscription(token)
