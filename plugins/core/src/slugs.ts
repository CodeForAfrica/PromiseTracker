/**
 * Slugs: the lower-case, hyphenated names used in addresses, such as
 * `nairobi-county` (section 11).
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Words that follow `/{lang}/{cc}/` in an address for something other than an
 * area or a national office, so neither may use them (section 11.2).
 */
export const RESERVED_IN_COUNTRY = [
  'officials',
  'e',
  'p',
  'a',
  'search',
  'feed.xml',
  'opengraph-image',
] as const

export const isReservedInCountry = (slug: string): boolean =>
  (RESERVED_IN_COUNTRY as readonly string[]).includes(slug)

/** A slug from a name: accents dropped, lower case, words joined by hyphens. */
export function slugify(name: string): string {
  const joined = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
  // Hyphens at the ends are trimmed with a loop: a pattern for them is slow on a long run of hyphens.
  let start = 0
  let end = joined.length
  while (start < end && joined[start] === '-') start += 1
  while (end > start && joined[end - 1] === '-') end -= 1
  return joined.slice(start, end)
}

/** Why a slug cannot be used, or null when it can. */
export function slugProblem(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug) return 'Give it a slug, such as nairobi-county.'
  if (!SLUG_PATTERN.test(slug)) {
    return 'Use lower-case letters, digits and single hyphens, such as nairobi-county.'
  }
  if (isReservedInCountry(slug)) return `"${slug}" is used by the site's own addresses.`
  return null
}

/**
 * Words that follow `/{lang}/` for something other than an editor page, so no
 * page may use them (section 11.2). Two-letter segments are countries.
 */
export const RESERVED_IN_LANGUAGE = ['topics', 'themes', 'search', 'opengraph-image'] as const

/** Why an editor page cannot use a slug, or null when it can (section 11.2). */
export function pageSlugProblem(slug: unknown): string | null {
  if (typeof slug !== 'string' || !slug) return 'Give it a slug, such as about.'
  if (!SLUG_PATTERN.test(slug)) {
    return 'Use lower-case letters, digits and single hyphens, such as about-us.'
  }
  if (slug.length === 2) return 'A two-letter slug is kept for countries. Use a longer one.'
  // A page under another one sits where a country's own words do, such as `/en/about/p`.
  if ((RESERVED_IN_LANGUAGE as readonly string[]).includes(slug) || isReservedInCountry(slug)) {
    return `"${slug}" is used by the site's own addresses.`
  }
  return null
}
