import { isNotAvailable } from '@promisetracker/sdk'
import { claimPath, localePath } from '@promisetracker/ui'

import { findSite, getClaim, getClaims, getCountry, orNull } from '@/data'
import { absolute } from '@/seo'
import { rss } from '@/xml'

type Props = { params: Promise<{ lang: string; cc: string }> }

/** How many claims a feed carries, newest first. */
const FEED_LENGTH = 30

/**
 * `/{lang}/{cc}/feed.xml` (section 11.3): a country's latest claims, each with
 * its rating and the date it was last reviewed.
 */
export async function GET(_request: Request, { params }: Props) {
  const { lang, cc } = await params
  const site = await findSite(lang)
  const country = site ? await orNull(getCountry(lang, cc)) : null
  if (!site || !country || isNotAvailable(country)) {
    return new Response('Not found', { status: 404 })
  }
  const list = await getClaims(lang, country.code, { sort: 'recent', limit: FEED_LENGTH })
  const claims = await Promise.all(
    list.items.map((item) => orNull(getClaim(lang, country.code, item.slug))),
  )
  const items = list.items.map((item, i) => {
    const claim = claims[i]
    const full = claim && !isNotAvailable(claim) ? claim : null
    const rating = item.rating ? `${site.strings.claimRating}: ${item.rating.label}. ` : ''
    return {
      title: item.title,
      link: absolute(claimPath(lang, country.code, item.slug)),
      description: `${rating}${full?.summary ?? ''}`.trim() || null,
      date: full?.lastReviewedAt ?? full?.ratedOn ?? item.saidOn?.value ?? null,
    }
  })
  const body = rss({
    title: `${country.name} · ${site.name}`,
    link: absolute(localePath(lang, `/${country.code}`)),
    self: absolute(localePath(lang, `/${country.code}/feed.xml`)),
    description: site.description ?? site.strings.lede,
    language: lang,
    items,
  })
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } })
}

/** Built per request from cached reads, so new claims appear and the build needs no database. */
export const dynamic = 'force-dynamic'
