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
  'lastReviewed',
  'timelineTitle',
  'historyTitle',
  'fullHistory',
  'backToClaim',
  'correction',
  'evidenceTitle',
  'latestChanges',
  'reportedBy',
  'copyCitation',
  'citationCopied',
  'citeAs',
  'citeAsUnreviewed',
  'notFoundTitle',
  'notFoundBody',
  'backHome',
  'footerNav',
  'initiative',
  'copyright',
  'search',
  'searchLabel',
  'searchPlaceholder',
  'searchTitle',
  'searchIntro',
  'searchResults',
  'searchFound',
  'searchNothing',
  'whoRepresents',
  'openPlace',
  'searchPeople',
  'searchClaims',
  'searchTopics',
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

export const EVIDENCE_KINDS = ['document', 'dataset', 'social-post', 'article'] as const
export const UPDATE_KINDS = ['first-rating', 'change', 'correction'] as const

/** A piece of evidence (section 7.6). Links are shown, never fetched. */
export const Evidence = z.object({
  id: z.string().min(1),
  kind: z.enum(EVIDENCE_KINDS),
  title: z.string().min(1),
  publisher: z.string().nullable(),
  date: PartialDate.nullable(),
  /** The link, or the address of the uploaded file. */
  url: z.string().nullable(),
  /** One line saying what the evidence shows. */
  finding: z.string().nullable(),
  thumbnail: Image.nullable(),
})
export type Evidence = z.infer<typeof Evidence>

/**
 * A dated entry in a claim's public history (section 7.6): the rating as of
 * that date, what happened, and the evidence. A correction fixes an earlier
 * mistake of ours and says so.
 */
export const ClaimUpdate = z.object({
  id: z.string().min(1),
  date: PartialDate,
  kind: z.enum(UPDATE_KINDS),
  rating: Rating.nullable(),
  title: z.string().min(1),
  narrative: z.string().nullable(),
  attribution: z.string().nullable(),
  evidence: z.array(Evidence),
})
export type ClaimUpdate = z.infer<typeof ClaimUpdate>

/** How many updates the claim page shows. The history page shows them all. */
export const TIMELINE_LENGTH = 5

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
  /** How many published updates the claim has. */
  updateCount: z.number().int().nonnegative(),
  /** The latest updates, newest first, up to `TIMELINE_LENGTH`. */
  timeline: z.array(ClaimUpdate),
  /** Every piece of evidence on the published updates, newest first. */
  evidence: z.array(Evidence),
  /**
   * How to cite the claim (section 12.1): its permanent address and the date
   * its rating was last reviewed. The address is a path when the site's
   * public address is not set.
   */
  citation: z.object({ url: z.string().min(1), text: z.string().min(1) }),
})
export type Claim = z.infer<typeof Claim>

/** `GET /api/v1/countries/{cc}/claims/{slug}/history`: every published update, newest first. */
export const ClaimHistory = z.object({
  claim: ClaimSummary,
  lastReviewedAt: z.string().nullable(),
  updates: z.array(ClaimUpdate),
})
export type ClaimHistory = z.infer<typeof ClaimHistory>

/** A recent change on an actor's claims, for "Latest changes" (section 10.2). */
export const ClaimChange = z.object({ claim: ClaimSummary, update: ClaimUpdate })
export type ClaimChange = z.infer<typeof ClaimChange>

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
  /** The latest updates on the actor's claims, newest first. */
  latestChanges: z.array(ClaimChange),
})
export type Actor = z.infer<typeof Actor>

/**
 * `GET /api/v1/redirects?path=`: where an address leads, for a former slug
 * (permanent) or a seat with one holder (temporary) (section 11.2). The path
 * has no language, such as `/ke/nairobi-county/governor`, and so has `to`.
 */
export const Redirect = z.object({ to: z.string().startsWith('/'), permanent: z.boolean() })
export type Redirect = z.infer<typeof Redirect>

/** A record the search index found: its title and address, so a result needs no second query. */
export const SearchItem = z.object({
  title: z.string().min(1),
  /** The address without its language, such as `/ke/e/william-ruto`. */
  url: z.string().startsWith('/'),
  /** The country's code. Topics belong to none. */
  country: z.string().length(2).nullable(),
})
export type SearchItem = z.infer<typeof SearchItem>

/** A seat that answers for a place, with its holders today. */
export const Representative = SeatRef.extend({ holders: z.array(Holder) })
export type Representative = z.infer<typeof Representative>

/**
 * A place that matched, with every seat that answers for it, from the
 * president down to the seats inside it, and their holders today (section 7.11).
 */
export const PlaceResult = z.object({
  country: z.string().length(2),
  area: AreaSummary,
  representatives: z.array(Representative),
})
export type PlaceResult = z.infer<typeof PlaceResult>

/** `GET /api/v1/search?q=&country=`: places with their representatives, then actors, claims and topics. */
export const SearchResults = z.object({
  query: z.string(),
  places: z.array(PlaceResult),
  actors: z.array(SearchItem),
  claims: z.array(SearchItem),
  topics: z.array(SearchItem),
  /** Every result above, each place counted once. */
  total: z.number().int().nonnegative(),
})
export type SearchResults = z.infer<typeof SearchResults>

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

// Requests (section 12.2). Every query parameter an endpoint takes is listed
// here. Anything else, or a value of the wrong form, is answered with a 400 in
// the `ApiError` shape. The OpenAPI document below is built from the same
// schemas, so the description and the checks cannot drift apart.

/** A slug in an address or a filter: lower case letters and digits, joined by hyphens. */
const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/** The most items one page of a list holds, and how many it holds when not asked. */
export const PAGE_LIMIT = { default: 50, max: 100 } as const

const Paging = {
  /** Where the page starts, as the previous page's `nextCursor` gave it. */
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_LIMIT.max).optional(),
}

/** Every endpoint answers in one language (section 12.2). The server checks it is in use. */
export const LocaleQuery = z.strictObject({
  locale: z.string().min(1).describe('A language the site runs in, such as `en` or `fr`.'),
})

export const ACTOR_SORTS = ['name', 'office'] as const
export const CLAIM_SORTS = ['recent', 'deadline', 'title'] as const

export const ActorsQuery = LocaleQuery.extend({
  kind: z.enum(ACTOR_KINDS).optional(),
  /** Holding a seat today, or held one before. */
  stage: z.enum(['current', 'past']).optional(),
  office: Slug.optional(),
  area: Slug.optional(),
  party: Slug.optional(),
  sort: z.enum(ACTOR_SORTS).optional(),
  ...Paging,
})

export const ClaimsQuery = LocaleQuery.extend({
  actor: Slug.optional(),
  topic: Slug.optional(),
  type: Slug.optional(),
  rating: Slug.optional(),
  tier: Slug.optional(),
  sort: z.enum(CLAIM_SORTS).optional(),
  ...Paging,
})

export const AreasQuery = LocaleQuery.extend({
  /** The area whose children to list. The top level without it. */
  parent: Slug.optional(),
})

export const RedirectQuery = LocaleQuery.extend({
  /** An address without its language, such as `/ke/nairobi-county/governor`. */
  path: z.string().startsWith('/').max(500),
})

export const SearchQuery = LocaleQuery.extend({
  /** What to look for: a place, a person, a claim or a topic. */
  q: z.string().trim().min(2).max(100),
  /** Only this country's results, and topics, which belong to every country. */
  country: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
})

/** The filters and order of an actor list, as the SDK takes them. */
export type ActorQuery = Omit<z.output<typeof ActorsQuery>, 'locale'>
/** The filters and order of a claim list, as the SDK takes them. */
export type ClaimQuery = Omit<z.output<typeof ClaimsQuery>, 'locale'>
/** A search's scope, as the SDK takes it. */
export type SearchScope = Omit<z.output<typeof SearchQuery>, 'locale' | 'q'>

type EndpointSpec = {
  /** OpenAPI form, such as `/countries/{code}`. */
  path: string
  summary: string
  query: z.ZodObject
  response: z.ZodType
  /** Whether it can answer "not available in this language" (section 8.3). */
  notAvailable: boolean
}

const Code = 'A country code, such as `ke`.'

/** Every read endpoint of `/api/v1` (section 12.1), in the order the specification lists them. */
export const V1_ENDPOINTS = [
  {
    path: '/site',
    summary: 'Languages, rating scales, interface text and navigation',
    query: LocaleQuery,
    response: SiteInfo,
    notAvailable: false,
  },
  {
    path: '/countries',
    summary: 'Countries published in this language',
    query: LocaleQuery,
    response: CountryList,
    notAvailable: false,
  },
  {
    path: '/countries/{code}',
    summary: 'One country and its counts',
    query: LocaleQuery,
    response: Country,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/offices',
    summary: "The country's offices, highest first",
    query: LocaleQuery,
    response: OfficeList,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/areas',
    summary: 'Areas, one level at a time',
    query: AreasQuery,
    response: AreaList,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/areas/{area}',
    summary: 'An area, the areas above it and its seats',
    query: LocaleQuery,
    response: Area,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/seats/{office}',
    summary: 'The current holders of a national seat',
    query: LocaleQuery,
    response: SeatHolders,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/seats/{area}/{office}',
    summary: 'The current holders of a seat',
    query: LocaleQuery,
    response: SeatHolders,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/actors',
    summary: 'Actors, filtered by kind, stage, office, area or party, and sorted',
    query: ActorsQuery,
    response: ActorList,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/actors/{slug}',
    summary: 'An actor, their terms and their record',
    query: LocaleQuery,
    response: Actor,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/claims',
    summary: 'Claims, filtered by actor, type, topic, rating or tier, and sorted, with figures',
    query: ClaimsQuery,
    response: ClaimList,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/claims/{slug}',
    summary: 'A claim, its rating and its history',
    query: LocaleQuery,
    response: Claim,
    notAvailable: true,
  },
  {
    path: '/countries/{code}/claims/{slug}/history',
    summary: "Every published update to a claim's rating, newest first",
    query: LocaleQuery,
    response: ClaimHistory,
    notAvailable: true,
  },
  {
    path: '/topics',
    summary: 'Topics, with how many published claims each has',
    query: LocaleQuery,
    response: TopicList,
    notAvailable: false,
  },
  {
    path: '/topics/{slug}',
    summary: 'A topic, with figures by country',
    query: LocaleQuery,
    response: Topic,
    notAvailable: true,
  },
  {
    path: '/search',
    summary: 'Places with everyone who represents them, then actors, claims and topics',
    query: SearchQuery,
    response: SearchResults,
    notAvailable: true,
  },
  {
    path: '/redirects',
    summary: 'Where a former address or a seat address leads',
    query: RedirectQuery,
    response: Redirect,
    notAvailable: false,
  },
] as const satisfies readonly EndpointSpec[]

const PATH_PARAMS: Record<string, string> = {
  code: Code,
  area: 'An area slug.',
  office: 'An office slug.',
  slug: 'A slug.',
}

/**
 * The OpenAPI 3.1 description of `/api/v1` (section 12.2), built from the
 * schemas above. Served at `/api/v1/openapi.json`.
 */
export function openApiDocument(): Record<string, unknown> {
  const components: Record<string, unknown> = {
    ApiError: z.toJSONSchema(ApiError),
    NotAvailable: z.toJSONSchema(NotAvailable),
  }
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
  const json = (schema: unknown) => ({ content: { 'application/json': { schema } } })
  const paths = Object.fromEntries(
    V1_ENDPOINTS.map((endpoint) => {
      const name = endpoint.path
        .split('/')
        .filter(Boolean)
        .map((part) => part.replace(/[{}]/g, ''))
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
      components[name] = z.toJSONSchema(endpoint.response, { io: 'output', unrepresentable: 'any' })
      const query = z.toJSONSchema(endpoint.query, { io: 'input' }) as {
        properties?: Record<string, Record<string, unknown>>
        required?: string[]
      }
      const pathParams = [...endpoint.path.matchAll(/\{(\w+)\}/g)].map(([, param = '']) => ({
        name: param,
        in: 'path',
        required: true,
        description: PATH_PARAMS[param],
        schema: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      }))
      const queryParams = Object.entries(query.properties ?? {}).map(([param, schema]) => {
        const { description, ...rest } = schema
        return {
          name: param,
          in: 'query',
          required: query.required?.includes(param) ?? false,
          ...(typeof description === 'string' ? { description } : {}),
          schema: rest,
        }
      })
      const notFound = endpoint.notAvailable
        ? {
            description:
              'Not found, or not published in this language. "Not available" names the languages it is in (section 8.3).',
            ...json({ oneOf: [ref('ApiError'), ref('NotAvailable')] }),
          }
        : { description: 'Not found.', ...json(ref('ApiError')) }
      return [
        endpoint.path,
        {
          get: {
            summary: endpoint.summary,
            parameters: [...pathParams, ...queryParams],
            responses: {
              200: {
                description: 'OK. Carries `ETag` and `Cache-Control`.',
                headers: {
                  ETag: { schema: { type: 'string' } },
                  'Cache-Control': { schema: { type: 'string' } },
                },
                ...json(ref(name)),
              },
              304: { description: 'Not modified: the `If-None-Match` ETag still matches.' },
              400: {
                description: 'A parameter is missing, unknown or of the wrong form.',
                ...json(ref('ApiError')),
              },
              404: notFound,
            },
          },
        },
      ]
    }),
  )
  return {
    openapi: '3.1.0',
    info: {
      title: 'PromiseTracker API',
      version: '1',
      description:
        'Read-only, published content only, one language at a time (section 12 of the system specification).',
    },
    servers: [{ url: '/api/v1' }],
    paths,
    components: { schemas: components },
  }
}
