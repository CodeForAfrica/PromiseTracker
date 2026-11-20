import { Card } from '@payloadcms/ui'
import type { Where, WidgetServerProps } from 'payload'

/**
 * Admin dashboard widgets. They run on the server, as signed-in users, and
 * Payload loads them by path, such as
 * `@promisetracker/plugin-core/widgets#AwaitingVerification`.
 */

/** Claims waiting for a verdict, not archived (section 5.1). */
export const AWAITING_VERIFICATION: Where = {
  and: [
    { 'verification.verdict': { equals: 'unverified' } },
    { recordStatus: { not_equals: 'archived' } },
  ],
}

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
  const queue =
    '/admin/collections/claims?where[and][0][verification.verdict][equals]=unverified&where[and][1][recordStatus][not_equals]=archived'
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
