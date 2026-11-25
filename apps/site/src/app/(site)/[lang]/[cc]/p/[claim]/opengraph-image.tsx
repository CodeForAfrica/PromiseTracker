import { isNotAvailable } from '@promisetracker/sdk'

import { DEFAULT_LOCALE, findSite, getClaim, getSite, orNull } from '@/data'
import { CONTENT_TYPE, SIZE, shareImage } from '@/share'

export const size = SIZE
export const contentType = CONTENT_TYPE

/** A claim's share image: who said it, the claim and its rating (section 10.7). */
export default async function Image({
  params,
}: {
  params: Promise<{ lang: string; cc: string; claim: string }>
}) {
  const { lang, cc, claim: slug } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  const claim = await orNull(getClaim(site.locale, cc, slug))
  if (!claim || isNotAvailable(claim)) return shareImage({ site, title: site.name })
  return shareImage({
    site,
    kicker: claim.actor.name,
    title: claim.title,
    rating: claim.rating,
  })
}
