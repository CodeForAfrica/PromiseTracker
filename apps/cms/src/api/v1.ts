import type { SiteInfo } from '@promisetracker/contract'
import { SiteInfo as SiteInfoSchema } from '@promisetracker/contract'
import type { Payload } from 'payload'

import type { Site } from '../payload-types'

/**
 * Handlers for `/api/v1`. The HTTP route and the SDK's local transport both
 * call these, so the site gets the same data however it is deployed.
 *
 * Records come typed from Payload's generated types. Each mapper turns one
 * into its public shape from the contract, so a change on either side fails
 * the type check here, and the result is parsed again at run time.
 */
const toSiteInfo = (site: Site): SiteInfo =>
  SiteInfoSchema.parse({ name: site.name, tagline: site.tagline ?? null })

type Handler = (payload: Payload, query: URLSearchParams) => Promise<unknown>

const routes: Record<string, Handler> = {
  '/site': async (payload) =>
    toSiteInfo(await payload.findGlobal({ slug: 'site', overrideAccess: false })),
}

/** Returns `undefined` when no handler matches the path. */
export async function handleV1(
  payload: Payload,
  path: string,
  query: URLSearchParams = new URLSearchParams(),
): Promise<unknown> {
  const handler = routes[path]
  return handler ? handler(payload, query) : undefined
}
