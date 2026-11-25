import type {
  Actor,
  ActorQuery,
  Area,
  Claim,
  ClaimHistory,
  ClaimQuery,
  Country,
  NotAvailable,
  Redirect,
  SearchResults,
  SearchScope,
  Topic,
} from '@promisetracker/contract'
import {
  ActorList,
  Actor as ActorSchema,
  AreaList,
  Area as AreaSchema,
  ClaimHistory as ClaimHistorySchema,
  ClaimList,
  Claim as ClaimSchema,
  CountryList,
  Country as CountrySchema,
  isNotAvailable,
  NotAvailable as NotAvailableSchema,
  OfficeList,
  Redirect as RedirectSchema,
  SearchResults as SearchResultsSchema,
  SeatHolders,
  SiteInfo,
  TopicList,
  Topic as TopicSchema,
} from '@promisetracker/contract'

// The filters and order of actor and claim lists come from the contract, which
// the API checks them against (section 12.2).
export type { ActorQuery, ClaimQuery, SearchScope }

/** A query as the API's parameters, leaving out what is not set. */
const params = (query: Readonly<Record<string, string | number | undefined>>) =>
  Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  )

/**
 * Moves a request for an API path to wherever the API runs. The local
 * transport calls the platform in the same process. The HTTP transport calls
 * the API over the network. Both return the status and the unparsed body.
 */
export interface Transport {
  get(path: string, query?: Record<string, string>): Promise<{ status: number; body: unknown }>
  /** Sends a form's fields (section 12.1). */
  post(path: string, body: Record<string, string>): Promise<{ status: number; body: unknown }>
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

/** The request was wrong, such as a language the site does not run in. */
export class BadRequestError extends Error {
  constructor(path: string, detail: string) {
    super(`Bad request for ${path}: ${detail}`)
    this.name = 'BadRequestError'
  }
}

/**
 * Calls the API over HTTP. `fetchImpl` is the global `fetch` unless given,
 * which lets tests answer requests with the route's own code.
 */
export function createHttpTransport(
  baseUrl: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Transport {
  const root = baseUrl.replace(/\/$/, '')
  return {
    async get(path, query) {
      const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
      const res = await fetchImpl(`${root}/api/v1${path}${qs}`, init)
      const body: unknown = await res.json().catch(() => null)
      return { status: res.status, body }
    },
    async post(path, fields) {
      const res = await fetchImpl(`${root}/api/v1${path}`, {
        ...init,
        method: 'POST',
        headers: { ...init.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      const body: unknown = await res.json().catch(() => null)
      return { status: res.status, body }
    },
  }
}

const detailOf = (body: unknown): string => {
  const error: unknown = body && typeof body === 'object' ? Reflect.get(body, 'error') : undefined
  return typeof error === 'string' ? error : 'no detail'
}

/** Turns a status into a result or an error. Only a 404 may carry "not available". */
function settle(path: string, status: number, body: unknown): unknown {
  if (status === 200) return body
  if (status === 404 && isNotAvailable(body)) return body
  if (status === 404) throw new NotFoundError(path)
  if (status === 400) throw new BadRequestError(path, detailOf(body))
  throw new Error(`API ${status} for ${path}`)
}

export function createSdk(transport: Transport) {
  const get = async (path: string, locale: string, query: Record<string, string> = {}) => {
    const { status, body } = await transport.get(path, { ...query, locale })
    return settle(path, status, body)
  }
  const cc = (code: string) => `/countries/${encodeURIComponent(code)}`
  return {
    /** Confirms a newsletter sign-up from its email's link. False when the link is old or used. */
    async confirmSubscription(token: string): Promise<boolean> {
      const { status } = await transport.post('/subscriptions/confirm', { token })
      if (status === 200) return true
      if (status === 404) return false
      throw new Error(`API ${status} for /subscriptions/confirm`)
    },
    /** Everything every page needs: languages, interface text, navigation. */
    async getSiteInfo(locale: string): Promise<SiteInfo> {
      return SiteInfo.parse(await get('/site', locale))
    },
    /** Countries published in this language. */
    async getCountries(locale: string): Promise<CountryList> {
      return CountryList.parse(await get('/countries', locale))
    },
    /** One country, or the languages it is published in when it is not in this one. */
    async getCountry(locale: string, code: string): Promise<Country | NotAvailable> {
      const result = await get(`/countries/${encodeURIComponent(code)}`, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : CountrySchema.parse(result)
    },
    /** A country's offices, highest first. */
    async getOffices(locale: string, code: string): Promise<OfficeList> {
      return OfficeList.parse(await get(`${cc(code)}/offices`, locale))
    },
    /** A country's areas one level at a time: the top level, or those in `parent`. */
    async getAreas(locale: string, code: string, parent?: string): Promise<AreaList> {
      return AreaList.parse(await get(`${cc(code)}/areas`, locale, parent ? { parent } : {}))
    },
    /** One area with its seats, or the languages it is published in. */
    async getArea(locale: string, code: string, area: string): Promise<Area | NotAvailable> {
      const result = await get(`${cc(code)}/areas/${encodeURIComponent(area)}`, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : AreaSchema.parse(result)
    },
    /** A seat's holders today. A national seat has no area. */
    async getSeat(
      locale: string,
      code: string,
      office: string,
      area?: string,
    ): Promise<SeatHolders | NotAvailable> {
      const path = area
        ? `${cc(code)}/seats/${encodeURIComponent(area)}/${encodeURIComponent(office)}`
        : `${cc(code)}/seats/${encodeURIComponent(office)}`
      const result = await get(path, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : SeatHolders.parse(result)
    },
    /** A country's actors, filtered and sorted. */
    async getActors(locale: string, code: string, query: ActorQuery = {}): Promise<ActorList> {
      return ActorList.parse(await get(`${cc(code)}/actors`, locale, params(query)))
    },
    /** One actor with their terms, or the languages their country is published in. */
    async getActor(locale: string, code: string, slug: string): Promise<Actor | NotAvailable> {
      const result = await get(`${cc(code)}/actors/${encodeURIComponent(slug)}`, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : ActorSchema.parse(result)
    },
    /** A country's claims, filtered and sorted, with the figures of every match. */
    async getClaims(locale: string, code: string, query: ClaimQuery = {}): Promise<ClaimList> {
      return ClaimList.parse(await get(`${cc(code)}/claims`, locale, params(query)))
    },
    /** One claim, or the languages it is published in. */
    async getClaim(locale: string, code: string, slug: string): Promise<Claim | NotAvailable> {
      const result = await get(`${cc(code)}/claims/${encodeURIComponent(slug)}`, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : ClaimSchema.parse(result)
    },
    /** A claim's full rating history, or the languages the claim is published in. */
    async getClaimHistory(
      locale: string,
      code: string,
      slug: string,
    ): Promise<ClaimHistory | NotAvailable> {
      const result = await get(`${cc(code)}/claims/${encodeURIComponent(slug)}/history`, locale)
      return isNotAvailable(result)
        ? NotAvailableSchema.parse(result)
        : ClaimHistorySchema.parse(result)
    },
    /** Every topic, with how many published claims it has. */
    async getTopics(locale: string): Promise<TopicList> {
      return TopicList.parse(await get('/topics', locale))
    },
    /** One topic with its figures by country, or the languages it has a name in. */
    async getTopic(locale: string, slug: string): Promise<Topic | NotAvailable> {
      const result = await get(`/topics/${encodeURIComponent(slug)}`, locale)
      return isNotAvailable(result) ? NotAvailableSchema.parse(result) : TopicSchema.parse(result)
    },
    /**
     * Places with everyone who represents them, then actors, claims and topics
     * (section 7.11). In one country, the languages it is published in when it
     * is not in this one.
     */
    async search(
      locale: string,
      q: string,
      scope: SearchScope = {},
    ): Promise<SearchResults | NotAvailable> {
      const result = await get('/search', locale, params({ q, ...scope }))
      return isNotAvailable(result)
        ? NotAvailableSchema.parse(result)
        : SearchResultsSchema.parse(result)
    },
    /** Where an address leads, or null when it leads nowhere else (section 11.2). */
    async getRedirect(locale: string, path: string): Promise<Redirect | null> {
      try {
        return RedirectSchema.parse(await get('/redirects', locale, { path }))
      } catch (error) {
        if (error instanceof NotFoundError) return null
        throw error
      }
    },
  }
}

export type Sdk = ReturnType<typeof createSdk>
export { isNotAvailable }
