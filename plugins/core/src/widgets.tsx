import { Card } from '@payloadcms/ui'
import type { Where, WidgetServerProps } from 'payload'

import { EMPTY_SEARCH_DAYS, emptySearches } from './search'
import { SUBMISSIONS, WAITING_SUBMISSIONS } from './submissions'
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

/**
 * Submissions waiting for a moderator, linking to the queue, and how many
 * changed the record: those accepted, each of which became a claim update.
 */
export async function WaitingSubmissions({ req }: WidgetServerProps) {
  const count = (where: Where) =>
    req.payload.count({ collection: SUBMISSIONS, where, overrideAccess: false, req })
  const [waiting, accepted] = await Promise.all([
    count(WAITING_SUBMISSIONS),
    count({ status: { equals: 'accepted' } }),
  ])
  const queue = `${req.payload.config.routes.admin}/collections/${SUBMISSIONS}?${whereToQuery(WAITING_SUBMISSIONS)}`
  const n = waiting.totalDocs
  const title =
    n === 0 ? 'No submissions waiting' : `${n} ${n === 1 ? 'submission' : 'submissions'} waiting`
  const changed = accepted.totalDocs
  return (
    <div className="collections__group">
      <h2 className="collections__label">Submissions</h2>
      <Card
        id="card-waiting-submissions"
        title={title}
        href={queue}
        buttonAriaLabel="Show the submissions waiting for a moderator"
      />
      <p style={{ marginTop: 'calc(var(--base) / 2)' }}>
        {changed === 0
          ? 'None has changed the record yet.'
          : `${changed} ${changed === 1 ? 'has' : 'have'} changed the record.`}
      </p>
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

/**
 * Searches that found nothing in the last 30 days (sections 16.4 and 18). Only
 * editors and super-admins see any: the log holds what people typed.
 */
const cell = { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' }

export async function EmptySearches({ req, user }: WidgetServerProps) {
  const rows = await emptySearches(req.payload, user ?? null)
  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '0 0 4px' }}>Searches that found nothing</h3>
      <p style={{ margin: '0 0 12px', color: 'var(--theme-elevation-600)' }}>
        The last {EMPTY_SEARCH_DAYS} days, most often first. A place here may be missing from the
        record, or spelt another way.
      </p>
      {rows.length === 0 ? (
        <p style={{ margin: 0 }}>Every search found something.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...cell, textAlign: 'start' }}>Search</th>
              <th style={{ ...cell, textAlign: 'end' }}>Times</th>
              <th style={{ ...cell, textAlign: 'end' }}>Last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.query}>
                <td style={cell}>{row.query}</td>
                <td style={{ ...cell, textAlign: 'end' }}>{row.times}</td>
                <td style={{ ...cell, textAlign: 'end' }}>{row.last.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
