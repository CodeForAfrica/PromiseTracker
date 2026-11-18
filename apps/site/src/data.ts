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

export const getSite = (locale: string) =>
  unstable_cache(() => sdk.getSiteInfo(locale), ['site', locale], { tags: ['site'] })()

export const getCountries = (locale: string) =>
  unstable_cache(() => sdk.getCountries(locale), ['countries', locale], { tags: ['countries'] })()

export const getCountry = (locale: string, code: string) =>
  unstable_cache(() => sdk.getCountry(locale, code), ['country', locale, code], {
    tags: [`country:${code}`],
  })()

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
  const { items } = await getCountries(locale)
  return { site, countries: items }
}

export { NotFoundError }
