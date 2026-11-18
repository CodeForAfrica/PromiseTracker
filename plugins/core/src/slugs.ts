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
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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
