import { isNotAvailable } from '@promisetracker/sdk'

import { DEFAULT_LOCALE, findSite, getClaims, getCountry, getSite, orNull } from '@/data'
import { CONTENT_TYPE, SIZE, shareImage, tierFigures } from '@/share'

export const size = SIZE
export const contentType = CONTENT_TYPE

/** A country's share image: its name and its headline figures (section 10.7). */
export default async function Image({ params }: { params: Promise<{ lang: string; cc: string }> }) {
  const { lang, cc } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  const country = await orNull(getCountry(site.locale, cc))
  if (!country || isNotAvailable(country)) return shareImage({ site, title: site.name })
  const claims = await getClaims(site.locale, country.code, { limit: 1 })
  return shareImage({
    site,
    kicker: site.strings.claims,
    title: country.name,
    detail: country.about,
    tiers: tierFigures(site, claims.figures),
  })
}
