import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

/** Deep enough for any country's nesting, and a stop if the data ever loops. */
const MAX_DEPTH = 20

export type AreaFamily = {
  /**
   * The areas above, nearest first: a constituency's county, then the
   * whole-country area, which is included because national offices answer for it.
   */
  ancestors: string[]
  /** Every area below, at any depth. */
  descendants: string[]
}

/**
 * Every area above and below one area, in one recursive query (section 16.2).
 * "Who represents this place" walks this tree: a search for a county finds its
 * constituencies' members, and the country's president.
 */
export async function areaFamily(payload: Payload, areaId: string): Promise<AreaFamily> {
  const { drizzle } = payload.db as unknown as PostgresAdapter
  const result = await drizzle.execute(sql`
    WITH RECURSIVE up AS (
      SELECT id, parent_id, 0 AS depth FROM areas WHERE id = ${areaId}
      UNION ALL
      SELECT a.id, a.parent_id, up.depth + 1 FROM areas a JOIN up ON a.id = up.parent_id
      WHERE up.depth < ${MAX_DEPTH}
    ),
    down AS (
      SELECT id, 0 AS depth FROM areas WHERE id = ${areaId}
      UNION ALL
      SELECT a.id, down.depth + 1 FROM areas a JOIN down ON a.parent_id = down.id
      WHERE down.depth < ${MAX_DEPTH}
    )
    SELECT 'up' AS direction, id, depth FROM up WHERE depth > 0
    UNION ALL
    SELECT 'down' AS direction, id, depth FROM down WHERE depth > 0
    ORDER BY direction, depth
  `)
  const rows = result.rows as { direction: string; id: string }[]
  return {
    ancestors: rows.filter((r) => r.direction === 'up').map((r) => String(r.id)),
    descendants: rows.filter((r) => r.direction === 'down').map((r) => String(r.id)),
  }
}
