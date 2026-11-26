import type { Actor, ActorRef, Claim, SiteInfo } from '@promisetracker/contract'
import { actorPath, claimPath, seatLabel } from '@promisetracker/ui'

import { absolute, publicOrigin } from './seo'

/**
 * schema.org data for search engines (section 10.7). Fields with no value are
 * left undefined, so JSON.stringify drops them.
 */

type Thing = Record<string, unknown>

const typeOf = (kind: ActorRef['kind']) => (kind === 'person' ? 'Person' : 'Organization')

const actorRef = (locale: string, code: string, actor: ActorRef, origin: string): Thing => ({
  '@type': typeOf(actor.kind),
  name: actor.name,
  url: absolute(actorPath(locale, code, actor.slug), origin),
})

/**
 * ClaimReview for a verified claim: the rating's value, and its scale's best
 * and worst values, become the rating number. A claim with no rating, or
 * whose scale the site does not list, has none.
 */
export function claimReview(site: SiteInfo, claim: Claim, origin = publicOrigin()): Thing | null {
  const { rating } = claim
  const scale = site.ratingScales.find((s) => s.id === claim.ratingScale)
  if (!rating || !scale) return null
  const url = absolute(claimPath(site.locale, claim.country, claim.slug), origin)
  return {
    '@context': 'https://schema.org',
    '@type': 'ClaimReview',
    url,
    inLanguage: site.locale,
    claimReviewed: claim.statement ?? claim.title,
    datePublished: claim.verification.date ?? claim.ratedOn ?? undefined,
    dateModified: claim.lastReviewedAt ?? undefined,
    author: { '@type': 'Organization', name: site.name, url: origin },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: rating.value,
      bestRating: scale.bestValue,
      worstRating: scale.worstValue,
      alternateName: rating.label,
    },
    itemReviewed: {
      '@type': 'Claim',
      author: actorRef(site.locale, claim.country, claim.actor, origin),
      datePublished: claim.saidOn?.value,
      appearance: claim.sourceUrl ? { '@type': 'CreativeWork', url: claim.sourceUrl } : undefined,
    },
  }
}

/** Person data for a person, Organization data for a party or an institution. */
export function actorData(
  site: SiteInfo,
  code: string,
  actor: Actor,
  origin = publicOrigin(),
): Thing {
  const seat = actor.seats[0]
  return {
    '@context': 'https://schema.org',
    ...actorRef(site.locale, code, actor, origin),
    alternateName: actor.shortName ?? undefined,
    description: actor.biography ?? undefined,
    image: actor.image ? new URL(actor.image.url, `${origin}/`).href : undefined,
    jobTitle: actor.kind === 'person' && seat ? seatLabel(seat) : undefined,
    affiliation:
      actor.kind === 'person' && actor.party
        ? actorRef(site.locale, code, actor.party, origin)
        : undefined,
    sameAs: actor.links.length > 0 ? actor.links.map((link) => link.url) : undefined,
  }
}
