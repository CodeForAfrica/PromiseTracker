import type { SectionId, SiteInfo } from '@promisetracker/contract'

/**
 * When a section shows (section 10.3). A section with nothing to show is left
 * out: never shown empty, greyed out, or as a zero. An editor can force a
 * section on or off in the site settings. Forced on, it shows even when its
 * rule would leave it out, but still never empty (D108).
 */

/** What a rule says about a section: whether it has anything, and whether its rule is met. */
export type SectionRule = { has: boolean; met: boolean }

const rule = (has: boolean, met: boolean = has): SectionRule => ({ has, met: has && met })

/** Whether a section shows, after an editor's override. */
export function shows(id: SectionId, forced: SiteInfo['sections'], { has, met }: SectionRule) {
  const override = forced[id]
  if (override === 'off' || !has) return false
  return override === 'on' || met
}

/** Who is delivering, and Officials: two or more current office holders. */
export const peopleRule = (currentHolders: number): SectionRule =>
  rule(currentHolders > 0, currentHolders >= 2)

/** Past administrations: at least one ended term. */
export const pastRule = (pastTerms: number): SectionRule => rule(pastTerms > 0)

/** Closing summary: the term has ended, and there is a summary to show. */
export const closingRule = (ended: boolean, summary: string | null | undefined): SectionRule =>
  rule(Boolean(summary?.trim()), ended)

/** Latest analysis: at least one published article. */
export const analysisRule = (articles: number): SectionRule => rule(articles > 0)

/**
 * Choose a country: a list with two or more countries, a single link with
 * one, nothing with none. Forced on, one country is shown as a list too.
 */
export function chooseCountry(
  forced: SiteInfo['sections'],
  countries: number,
): 'list' | 'link' | null {
  if (!shows('home.choose-country', forced, rule(countries > 0))) return null
  return countries >= 2 || forced['home.choose-country'] === 'on' ? 'list' : 'link'
}

/**
 * In focus on the homepage: a theme spanning two or more countries, or,
 * on a site with one country, a theme within it. A theme with no published
 * claims has nothing to show.
 */
export const inFocusRule = (theme: {
  countries: number
  claims: number
  siteCountries: number
}): SectionRule =>
  rule(
    theme.countries > 0 && theme.claims > 0,
    theme.countries >= 2 || (theme.siteCountries === 1 && theme.countries === 1),
  )

/** Any list that shows when it has something in it, such as partners or a country's picks. */
export const listRule = (items: number): SectionRule => rule(items > 0)
