import { z } from 'zod'

/**
 * The public API's response shapes. Every response the SDK returns is parsed
 * with one of these schemas, whichever transport fetched it.
 */

/**
 * The interface text the default site uses (section 10.5). The keys are fixed
 * here. plugin-site holds English and French text for each, and editors write
 * or change it per language in the admin.
 */
export const STRING_KEYS = [
  'skipToContent',
  'home',
  'verified',
  'countriesNav',
  'otherCountries',
  'menu',
  'closeMenu',
  'language',
  'headline',
  'headlineTail',
  'lede',
  'aboutSite',
  'chooseCountry',
  'notAvailableTitle',
  'notAvailableBody',
  'notFoundTitle',
  'notFoundBody',
  'backHome',
  'footerNav',
  'initiative',
  'copyright',
] as const
export type StringKey = (typeof STRING_KEYS)[number]

export const Strings = z.object(
  Object.fromEntries(STRING_KEYS.map((key) => [key, z.string()])) as Record<StringKey, z.ZodString>,
)
export type Strings = z.infer<typeof Strings>

export const Language = z.object({
  code: z.string().min(2),
  label: z.string().min(1),
  rtl: z.boolean(),
})
export type Language = z.infer<typeof Language>

const NavLink = z.object({ label: z.string().min(1), url: z.string().min(1) })
export type NavLink = z.infer<typeof NavLink>

const Colour = z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)

/** A group of ratings, such as "Promise kept" (section 7.4). */
export const RatingTier = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  colour: Colour,
})
export type RatingTier = z.infer<typeof RatingTier>

/**
 * One rating on a scale. Its label and colours come from editors, so the
 * site never names a rating in code (D22).
 */
export const Rating = z.object({
  slug: z.string().min(1),
  label: z.string().min(1),
  definition: z.string().nullable(),
  /** The slug of its tier. */
  tier: z.string().min(1),
  colour: Colour,
  textColour: Colour,
  /** Its number on the scale, for ClaimReview data (section 10.7). */
  value: z.number(),
  needsDeadline: z.boolean(),
  isStarting: z.boolean(),
  /** Kept so older claims and their history still show it. Not given to new claims. */
  retired: z.boolean(),
})
export type Rating = z.infer<typeof Rating>

/** A rating scale with its tiers and ratings, in the order editors set. */
export const RatingScale = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  bestValue: z.number(),
  worstValue: z.number(),
  tiers: z.array(RatingTier),
  ratings: z.array(Rating),
})
export type RatingScale = z.infer<typeof RatingScale>

/** `GET /api/v1/site`: what every page of the default site needs. */
export const SiteInfo = z.object({
  name: z.string().min(1),
  /** The language this response is in. */
  locale: z.string(),
  defaultLanguage: z.string(),
  /** The languages the site runs in, the default first. */
  languages: z.array(Language).min(1),
  /** One line under the name (section 10.2). */
  description: z.string().nullable(),
  /** The longer explanation, collapsed by default. */
  explainer: z.string().nullable(),
  strings: Strings,
  navigation: z.array(NavLink),
  footer: z.object({ about: z.string().nullable(), links: z.array(NavLink) }),
  /** Every rating scale, so any page can show any claim's rating. */
  ratingScales: z.array(RatingScale),
})
export type SiteInfo = z.infer<typeof SiteInfo>

export const CountrySummary = z.object({
  code: z.string().length(2),
  name: z.string().min(1),
  region: z.string().nullable(),
})
export type CountrySummary = z.infer<typeof CountrySummary>

/** `GET /api/v1/countries`. */
export const CountryList = z.object({
  items: z.array(CountrySummary),
  total: z.number().int().nonnegative(),
  /** For the next page. Null when this is the last one (section 12.2). */
  nextCursor: z.string().nullable(),
})
export type CountryList = z.infer<typeof CountryList>

/** `GET /api/v1/countries/{cc}`. */
export const Country = CountrySummary.extend({
  about: z.string().nullable(),
  defaultLanguage: z.string().nullable(),
})
export type Country = z.infer<typeof Country>

/**
 * A record that exists but is not published in the language asked for
 * (section 8.3, D30). It names the languages it is published in, so the site
 * can link to them. The API sends it with status 404.
 */
export const NotAvailable = z.object({
  error: z.literal('not-available'),
  availableIn: z.array(Language).min(1),
})
export type NotAvailable = z.infer<typeof NotAvailable>

export const isNotAvailable = (value: unknown): value is NotAvailable =>
  NotAvailable.safeParse(value).success

/** Any error the API returns. */
export const ApiError = z.object({ error: z.string() })

const ServiceHealth = z.object({
  healthy: z.boolean(),
  latencyMs: z.number().nonnegative(),
  kind: z.string().optional(),
  error: z.string().optional(),
})
export type ServiceHealth = z.infer<typeof ServiceHealth>

export const Health = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  plugins: z.object({ enabled: z.array(z.string()) }),
  /** The adapter ids running for each port. */
  ports: z.record(z.string(), z.array(z.string())),
  services: z.record(z.string(), ServiceHealth),
})
export type Health = z.infer<typeof Health>
