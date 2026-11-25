import { isNotAvailable } from '@promisetracker/sdk'
import { seatLabel } from '@promisetracker/ui'

import { DEFAULT_LOCALE, findSite, getActor, getSite, orNull } from '@/data'
import { CONTENT_TYPE, SIZE, shareImage, tierFigures } from '@/share'

export const size = SIZE
export const contentType = CONTENT_TYPE

/** An actor's share image: who they are, their record and their key claim (section 10.7). */
export default async function Image({
  params,
}: {
  params: Promise<{ lang: string; cc: string; actor: string }>
}) {
  const { lang, cc, actor: slug } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  const actor = await orNull(getActor(site.locale, cc, slug))
  if (!actor || isNotAvailable(actor)) return shareImage({ site, title: site.name })
  const seat = actor.seats[0]
  return shareImage({
    site,
    kicker: seat ? seatLabel(seat) : (actor.party?.name ?? undefined),
    title: actor.name,
    detail: actor.keyClaim?.claim.title,
    rating: actor.keyClaim?.claim.rating,
    tiers: tierFigures(site, actor.record),
  })
}
