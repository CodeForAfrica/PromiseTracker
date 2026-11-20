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
  'answersFor',
  'seatsInArea',
  'breadcrumb',
  'notAvailableBody',
  'officials',
  'seeAllOfficials',
  'whoIsDelivering',
  'pastAdministrations',
  'whoThisIs',
  'timeInOffice',
  'present',
  'closingSummary',
  'succeededBy',
  'formerHolder',
  'noHolder',
  'links',
  'photoCredit',
  'filterOffice',
  'filterArea',
  'filterParty',
  'filterAll',
  'sortBy',
  'sortName',
  'sortOffice',
  'showResults',
  'noMatches',
  'nextPage',
  'claims',
  'recordSoFar',
  'keyClaim',
  'claimWho',
  'claimWhere',
  'claimWhen',
  'claimByWhen',
  'claimRating',
  'claimSaid',
  'claimSource',
  'filterRating',
  'filterTopic',
  'noClaims',
  'figureOf',
  'figuresByCountry',
  'claimsOnTopic',
  'filterCountry',
  'verifiedOn',
  'verifiedTitle',
  'verifiedReport',
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
  /** What the rules for the country page's sections need (section 10.3). */
  counts: z.object({
    /** People holding an office today. */
    currentHolders: z.number().int().nonnegative(),
    /** Terms that have ended. */
    pastTerms: z.number().int().nonnegative(),
  }),
})
export type Country = z.infer<typeof Country>

/** An office in a country's list, such as Governor (section 7.2). */
export const Office = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().nullable(),
  /** The kind of area it answers for. Null for an office with no area. */
  areaType: z.string().nullable(),
  holdersPerSeat: z.number().int().positive(),
})
export type Office = z.infer<typeof Office>

/** `GET /api/v1/countries/{cc}/offices`, highest office first. */
export const OfficeList = z.object({ items: z.array(Office) })
export type OfficeList = z.infer<typeof OfficeList>

export const AreaSummary = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
})
export type AreaSummary = z.infer<typeof AreaSummary>

/** `GET /api/v1/countries/{cc}/areas?parent=`, one level at a time. */
export const AreaList = z.object({
  items: z.array(AreaSummary),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})
export type AreaList = z.infer<typeof AreaList>

export const ACTOR_KINDS = ['person', 'party', 'institution'] as const
export const TERM_STAGES = ['candidate', 'current', 'past'] as const

/** A public image, such as an actor's photo. */
export const Image = z.object({
  url: z.string().min(1),
  alt: z.string(),
  credit: z.string().nullable(),
})
export type Image = z.infer<typeof Image>

/** An actor named on another record: a holder, a party or a successor. */
export const ActorRef = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(ACTOR_KINDS),
})
export type ActorRef = z.infer<typeof ActorRef>

const OfficeRef = Office.pick({ slug: true, name: true, shortName: true })

/** Where an actor sits: an office, and the area for offices that have one. */
export const SeatRef = z.object({ office: OfficeRef, area: AreaSummary.nullable() })
export type SeatRef = z.infer<typeof SeatRef>

/** Someone holding a seat today. */
export const Holder = ActorRef.extend({
  image: Image.nullable(),
  party: ActorRef.nullable(),
})
export type Holder = z.infer<typeof Holder>

/** A seat: an area plus an office, with its holders today (section 7.2). */
export const Seat = z.object({
  office: OfficeRef,
  holdersPerSeat: z.number().int().positive(),
  holders: z.array(Holder),
})
export type Seat = z.infer<typeof Seat>

/** `GET /api/v1/countries/{cc}/seats/{area}/{office}`, or `/seats/{office}` for a national one. */
export const SeatHolders = Seat.extend({ area: AreaSummary.nullable() })
export type SeatHolders = z.infer<typeof SeatHolders>

/** An actor in a list. `seats` are the ones held today. */
export const ActorSummary = Holder.extend({
  /** Current while they hold a seat. Past once every term has ended (section 7.3). */
  stage: z.enum(['current', 'past']),
  seats: z.array(SeatRef),
})
export type ActorSummary = z.infer<typeof ActorSummary>

/**
 * `GET /api/v1/countries/{cc}/actors`.
 *
 * - `stage=current` lists those holding a seat today, and `stage=past` those
 *   who held one before. Parties and institutions hold no seats, so they
 *   appear only in a list with no stage, where their stage is `current`.
 * - `nextCursor` is an offset. A term that starts or ends between two
 *   requests can shift the list by one.
 */
export const ActorList = z.object({
  items: z.array(ActorSummary),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})
export type ActorList = z.infer<typeof ActorList>

/** An actor's time in a seat (section 7.3). Dates are YYYY-MM-DD. */
export const Term = SeatRef.extend({
  party: ActorRef.nullable(),
  electedOn: z.string().nullable(),
  startsOn: z.string(),
  endsOn: z.string().nullable(),
  stage: z.enum(TERM_STAGES),
  closingSummary: z.string().nullable(),
  successor: ActorRef.nullable(),
})
export type Term = z.infer<typeof Term>

/** `GET /api/v1/countries/{cc}/actors/{slug}`. */
/**
 * A date that may be only a year or a month (section 7.5), written `2027`,
 * `2027-08` or `2027-08-09`.
 */
export const PartialDate = z.object({
  value: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/),
  precision: z.enum(['year', 'month', 'day']),
})
export type PartialDate = z.infer<typeof PartialDate>

/**
 * Rating figures, the same shape everywhere (section 12.2): counts by rating
 * and by tier, the total, and whether to show counts or percentages. Below the
 * threshold in Settings a page shows "1 of 3", not "33%" (section 10.4).
 */
export const Figures = z.object({
  total: z.number().int().nonnegative(),
  form: z.enum(['counts', 'percentages']),
  byRating: z.record(z.string(), z.number().int().nonnegative()),
  byTier: z.record(z.string(), z.number().int().nonnegative()),
})
export type Figures = z.infer<typeof Figures>

/** A topic, such as Health, with the broader one it sits under. */
export const TopicSummary = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  colour: z.string().nullable(),
  parent: z.object({ slug: z.string().min(1), name: z.string().min(1) }).nullable(),
})
export type TopicSummary = z.infer<typeof TopicSummary>

/** A claim in a list. Its rating comes with its scale's id, to look up in the site's scales. */
export const ClaimSummary = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  country: z.string().length(2),
  actor: ActorRef,
  topic: TopicSummary.nullable(),
  rating: Rating.nullable(),
  ratingScale: z.string().nullable(),
  saidOn: PartialDate.nullable(),
  deadline: PartialDate.nullable(),
  deadlineText: z.string().nullable(),
})
export type ClaimSummary = z.infer<typeof ClaimSummary>

/** `GET /api/v1/countries/{cc}/claims`, with the figures of every claim that matches. */
export const ClaimList = z.object({
  items: z.array(ClaimSummary),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  figures: Figures,
})
export type ClaimList = z.infer<typeof ClaimList>

/** `GET /api/v1/countries/{cc}/claims/{slug}` (section 7.5). */
export const Claim = ClaimSummary.extend({
  /** The exact words, in the language they were said. */
  statement: z.string().nullable(),
  summary: z.string().nullable(),
  type: z.object({ slug: z.string().min(1), name: z.string().min(1) }).nullable(),
  coActors: z.array(ActorRef),
  /** The seat of the term the claim belongs to. */
  seat: SeatRef.nullable(),
  /** Where it applies, when narrower than the seat. */
  area: AreaSummary.nullable(),
  saidAt: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  sourceLocator: z.string().nullable(),
  ratedOn: z.string().nullable(),
  lastReviewedAt: z.string().nullable(),
  image: Image.nullable(),
  /**
   * How the claim was checked (section 7.5). A published claim is always
   * verified. Who verified it is internal and never here (section 13).
   */
  verification: z.object({
    /** YYYY-MM-DD. */
    date: z.string().nullable(),
    rationale: z.string().nullable(),
    reportUrl: z.string().nullable(),
  }),
})
export type Claim = z.infer<typeof Claim>

/** `GET /api/v1/topics`: every topic, with how many published claims it has. */
export const TopicList = z.object({
  items: z.array(TopicSummary.extend({ claims: z.number().int().nonnegative() })),
})
export type TopicList = z.infer<typeof TopicList>

/** `GET /api/v1/topics/{slug}`: a topic, the ones under it, and figures by country. */
export const Topic = TopicSummary.extend({
  description: z.string().nullable(),
  children: z.array(TopicSummary),
  countries: z.array(z.object({ country: CountrySummary, figures: Figures })),
})
export type Topic = z.infer<typeof Topic>

export const Actor = ActorSummary.extend({
  shortName: z.string().nullable(),
  honorific: z.string().nullable(),
  institutionType: z.string().nullable(),
  biography: z.string().nullable(),
  links: z.array(z.object({ type: z.string(), url: z.string() })),
  /** Every term, the latest first. Terms not yet started are left out. */
  terms: z.array(Term),
  /** The claim an editor marked as the one that matters most, and why. */
  keyClaim: z.object({ claim: ClaimSummary, note: z.string().nullable() }).nullable(),
  /** The figures of every published claim the actor made. */
  record: Figures,
})
export type Actor = z.infer<typeof Actor>

/**
 * `GET /api/v1/redirects?path=`: where an address leads, for a former slug
 * (permanent) or a seat with one holder (temporary) (section 11.2). The path
 * has no language, such as `/ke/nairobi-county/governor`, and so has `to`.
 */
export const Redirect = z.object({ to: z.string().startsWith('/'), permanent: z.boolean() })
export type Redirect = z.infer<typeof Redirect>

/** `GET /api/v1/countries/{cc}/areas/{area}`. */
export const Area = AreaSummary.extend({
  /** The areas above it, the country first. */
  ancestors: z.array(AreaSummary),
  seats: z.array(Seat),
  /** Whether it has a page of its own, from its page setting and its seats (section 7.2). */
  hasPage: z.boolean(),
  /** How many areas sit directly in it. */
  children: z.number().int().nonnegative(),
})
export type Area = z.infer<typeof Area>

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
