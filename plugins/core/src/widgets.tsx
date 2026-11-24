import type { CollectionSlug, Payload, WidgetServerProps } from 'payload'

import { SEARCH_LOG_SLUG } from './search'

/**
 * Admin dashboard widgets (section 16.4). They are server components: Payload
 * loads them by path, such as `@promisetracker/plugin-core/widgets#EmptySearches`,
 * and renders them with the signed-in user's request.
 */

/** How far back the widget looks, in days. */
export const EMPTY_SEARCH_DAYS = 30
/** How many searches it lists. */
export const EMPTY_SEARCH_ROWS = 10
/** The most log entries it reads to count them. */
const SCAN = 2000

export type EmptySearch = { query: string; times: number; last: string }

/**
 * Searches that found nothing, most often first, with when each was last
 * tried (section 18). They test whether location search works, and list the
 * places the record is missing. Searches differing only in case or spacing
 * count as one.
 */
export async function emptySearches(
  payload: Payload,
  user: WidgetServerProps['user'],
  now: Date = new Date(),
): Promise<EmptySearch[]> {
  const since = new Date(now.getTime() - EMPTY_SEARCH_DAYS * 24 * 60 * 60 * 1000)
  const { docs } = await payload.find({
    collection: SEARCH_LOG_SLUG as CollectionSlug,
    where: {
      and: [{ results: { equals: 0 } }, { createdAt: { greater_than: since.toISOString() } }],
    },
    sort: '-createdAt',
    limit: SCAN,
    depth: 0,
    // As the signed-in user: the log's own rule says who may read it.
    overrideAccess: false,
    ...(user ? { user } : {}),
  })
  const byQuery = new Map<string, EmptySearch>()
  for (const doc of docs as unknown as { query?: unknown; createdAt?: unknown }[]) {
    if (typeof doc.query !== 'string') continue
    const key = doc.query.trim().replace(/\s+/g, ' ').toLowerCase()
    const seen = byQuery.get(key)
    const at = typeof doc.createdAt === 'string' ? doc.createdAt : ''
    if (seen) seen.times += 1
    else byQuery.set(key, { query: doc.query.trim(), times: 1, last: at })
  }
  return [...byQuery.values()]
    .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last))
    .slice(0, EMPTY_SEARCH_ROWS)
}

const cell = { padding: '6px 8px', borderBottom: '1px solid var(--theme-elevation-100)' }

export async function EmptySearches({ req, user }: WidgetServerProps) {
  const rows = await emptySearches(req.payload, user)
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
