import { Card } from '@payloadcms/ui'
import type { Where, WidgetServerProps } from 'payload'

import { AWAITING_VERIFICATION, whereToQuery } from './verificationQueue'

/**
 * Admin dashboard widgets. They run on the server, as signed-in users, and
 * Payload loads them by path, such as
 * `@promisetracker/plugin-core/widgets#AwaitingVerification`.
 */

/**
 * How many claims wait for verification, linking to the queue (section 5.1).
 * Built like Payload's own collections widget: a group heading over a card.
 */
export async function AwaitingVerification({ req }: WidgetServerProps) {
  const { totalDocs } = await req.payload.count({
    collection: 'claims' as never,
    where: AWAITING_VERIFICATION,
    overrideAccess: false,
    req,
  })
  // The same filter as the saved view, under the admin's configured route.
  const queue = `${req.payload.config.routes.admin}/collections/claims?${whereToQuery(AWAITING_VERIFICATION)}`
  const title =
    totalDocs === 0
      ? 'No claims awaiting verification'
      : `${totalDocs} ${totalDocs === 1 ? 'claim' : 'claims'} awaiting verification`
  return (
    <div className="collections__group">
      <h2 className="collections__label">Verification</h2>
      <Card
        id="card-awaiting-verification"
        title={title}
        href={queue}
        buttonAriaLabel="Show the claims awaiting verification"
      />
    </div>
  )
}

/** How many claims the review widget lists. */
const REVIEW_LIST = 5

/**
 * The claims not reviewed for the longest time (section 8.4): never reviewed
 * first, then the oldest last-reviewed date. Built like Payload's own
 * collections widget.
 */
export async function LeastRecentlyReviewed({ req }: WidgetServerProps) {
  const find = (where: Where, sort: string, limit: number) =>
    req.payload.find({
      collection: 'claims' as never,
      where: { and: [{ recordStatus: { not_equals: 'archived' } }, where] },
      sort,
      limit,
      depth: 0,
      select: { title: true, lastReviewedAt: true } as never,
      overrideAccess: false,
      req,
    })
  const never = await find({ lastReviewedAt: { exists: false } }, 'createdAt', REVIEW_LIST)
  const reviewed =
    never.docs.length < REVIEW_LIST
      ? await find(
          { lastReviewedAt: { exists: true } },
          'lastReviewedAt',
          REVIEW_LIST - never.docs.length,
        )
      : { docs: [] }
  const claims = [...never.docs, ...reviewed.docs] as {
    id: string
    title?: string | null
    lastReviewedAt?: string | null
  }[]
  const admin = req.payload.config.routes.admin
  const when = (date?: string | null) =>
    date
      ? `last reviewed ${new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date))}`
      : 'never reviewed'
  return (
    <div className="collections__group">
      <h2 className="collections__label">Longest since review</h2>
      {claims.length === 0 ? (
        <p>No claims yet.</p>
      ) : (
        // One card per row, full width, so a claim's title is not cut short.
        <ul
          style={{
            display: 'grid',
            gap: 'var(--spacer-2)',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {claims.map((claim) => (
            <li key={claim.id}>
              <Card
                id={`card-review-${claim.id}`}
                title={`${claim.title ?? 'Untitled'}, ${when(claim.lastReviewedAt)}`}
                href={`${admin}/collections/claims/${claim.id}`}
                buttonAriaLabel={`Open ${claim.title ?? 'the claim'}`}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
