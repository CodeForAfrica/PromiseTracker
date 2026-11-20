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

/** How many claims wait for verification, with a link to the queue (section 5.1). */
export async function AwaitingVerification({ req }: WidgetServerProps) {
  const { totalDocs } = await req.payload.count({
    collection: 'claims' as never,
    where: AWAITING_VERIFICATION,
    overrideAccess: false,
    req,
  })
  const queue =
    '/admin/collections/claims?where[and][0][verification.verdict][equals]=unverified&where[and][1][recordStatus][not_equals]=archived'
  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ margin: 0 }}>Awaiting verification</h3>
      <p style={{ fontSize: 32, fontWeight: 600, margin: '8px 0' }}>{totalDocs}</p>
      <a href={queue}>{totalDocs === 1 ? 'Review the claim' : 'Review the claims'}</a>
    </div>
  )
}
