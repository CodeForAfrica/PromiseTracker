import { SiteInfo } from '@promisetracker/contract'

/**
 * Moves a request for an API path to wherever the API runs. The local
 * transport calls the platform in the same process. The HTTP transport calls
 * the API over the network. Both return unparsed JSON.
 */
export interface Transport {
  get(path: string, query?: Record<string, string>): Promise<unknown>
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`)
    this.name = 'NotFoundError'
  }
}

export function createHttpTransport(baseUrl: string, init: RequestInit = {}): Transport {
  const root = baseUrl.replace(/\/$/, '')
  return {
    async get(path, query) {
      const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
      const res = await fetch(`${root}/api/v1${path}${qs}`, init)
      if (res.status === 404) throw new NotFoundError(path)
      if (!res.ok) throw new Error(`API ${res.status} for ${path}`)
      return res.json()
    },
  }
}

export function createSdk(transport: Transport) {
  return {
    async getSiteInfo(): Promise<SiteInfo> {
      return SiteInfo.parse(await transport.get('/site'))
    },
  }
}

export type Sdk = ReturnType<typeof createSdk>
