import type { Area, Country, NotAvailable } from '@promisetracker/contract'
import {
  AreaList,
  Area as AreaSchema,
  CountryList,
  Country as CountrySchema,
  isNotAvailable,
  NotAvailable as NotAvailableSchema,
  OfficeList,
  SiteInfo,
} from '@promisetracker/contract'

/**
 * Moves a request for an API path to wherever the API runs. The local
 * transport calls the platform in the same process. The HTTP transport calls
 * the API over the network. Both return the status and the unparsed body.
 */
export interface Transport {
  get(path: string, query?: Record<string, string>): Promise<{ status: number; body: unknown }>
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

export function createHttpTransport(baseUrl: string, init: RequestInit = {}): Transport {
  const root = baseUrl.replace(/\/$/, '')
  return {
    async get(path, query) {
      const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
      const res = await fetch(`${root}/api/v1${path}${qs}`, init)
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
  }
}

export type Sdk = ReturnType<typeof createSdk>
export { isNotAvailable }
