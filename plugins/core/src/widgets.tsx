import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest, WidgetServerProps } from 'payload'

import { readSearchLog } from './search'

/**
 * Admin dashboard widgets (section 16.4). They are server components: Payload
 * loads them by path, such as `@promisetracker/plugin-core/widgets#EmptySearches`,
 * and renders them with the signed-in user's request.
 */

/** How far back the widget looks, in days. */
export const EMPTY_SEARCH_DAYS = 30
/** How many searches it lists. */
export const EMPTY_SEARCH_ROWS = 10

export type EmptySearch = { query: string; times: number; last: string }

type Row = { query: string; times: number | string; last: Date | string }

/**
 * Searches that found nothing, most often first, with when each was last
 * tried (section 18). They test whether location search works, and list the
 * places the record is missing. Searches differing only in case or spacing
 * count as one. The database counts them, so every search in the period counts.
 */
export async function emptySearches(
  payload: Payload,
  user: WidgetServerProps['user'],
  now: Date = new Date(),
): Promise<EmptySearch[]> {
  // The log's own read rule, applied here because the count is one SQL query.
  if (!readSearchLog({ req: { user } as PayloadRequest })) return []
  const since = new Date(now.getTime() - EMPTY_SEARCH_DAYS * 24 * 60 * 60 * 1000)
  const { drizzle } = payload.db as unknown as PostgresAdapter
  const result = await drizzle.execute(sql`
    SELECT
      (array_agg(btrim("query") ORDER BY "created_at" DESC))[1] AS "query",
      count(*)::int AS "times",
      max("created_at") AS "last"
    FROM "search_log"
    WHERE "results" = 0 AND "created_at" > ${since.toISOString()}
    GROUP BY lower(regexp_replace(btrim("query"), '\\s+', ' ', 'g'))
    ORDER BY "times" DESC, "last" DESC
    LIMIT ${EMPTY_SEARCH_ROWS}`)
  return (result.rows as Row[]).map((row) => ({
    query: row.query,
    times: Number(row.times),
    last: new Date(row.last).toISOString(),
  }))
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
