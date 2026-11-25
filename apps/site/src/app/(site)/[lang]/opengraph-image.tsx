import { DEFAULT_LOCALE, findSite, getClaims, getCountries, getSite } from '@/data'
import { addFigures, CONTENT_TYPE, SIZE, shareImage, tierFigures } from '@/share'

export const size = SIZE
export const contentType = CONTENT_TYPE

/** The home page's share image: the site, and the figures of every country (section 10.7). */
export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  const { items } = await getCountries(site.locale)
  const lists = await Promise.all(items.map((c) => getClaims(site.locale, c.code, { limit: 1 })))
  const figures = addFigures(lists.map((list) => list.figures))
  return shareImage({
    site,
    title: site.name,
    detail: site.description ?? site.strings.lede,
    tiers: tierFigures(site, figures),
  })
}
