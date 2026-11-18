import 'server-only'

import type { CountrySummary, SiteInfo } from '@promisetracker/contract'
import { BadRequestError, NotFoundError } from '@promisetracker/sdk'
import { unstable_cache } from 'next/cache'
import { notFound } from 'next/navigation'

import { sdk } from '@/platform/sdk'

/**
 * The site's reads, cached by tag (section 17). A change in the admin
 * refreshes the tags it touches at once, through the internal revalidate
 * route, so nothing here expires on a timer.
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

/** A country's areas and offices change together, so they share one tag. */
export const getArea = (locale: string, code: string, area: string) =>
  unstable_cache(() => sdk.getArea(locale, code, area), [RUN, 'area', locale, code, area], {
    tags: [`places:${code}`, `country:${code}`],
  })()

export const getCountry = (locale: string, code: string) =>
  unstable_cache(() => sdk.getCountry(locale, code), [RUN, 'country', locale, code], {
    tags: [`country:${code}`],
  })()

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
