import type { Payload } from 'payload'
import pg from 'pg'

import { assertRuntimeEnv, databaseUrl } from './env'
import { getPayload } from './getPayload'

// Any fixed number. Every PromiseTracker process uses the same one.
const MIGRATION_LOCK_KEY = 6_410_663

/**
 * Starts Payload when a server starts. In production Payload applies pending
 * migrations as it starts, and its Postgres adapter takes no lock, so replicas
 * starting together could run the same migration twice. A Postgres advisory
 * lock lets one process start Payload at a time. The rest wait, then find
 * nothing left to migrate.
 */
export async function startPayload(): Promise<Payload> {
  assertRuntimeEnv()
  if (process.env.NODE_ENV !== 'production') return getPayload()

  const client = new pg.Client({ connectionString: databaseUrl() })
  await client.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])
    return await getPayload()
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {})
    await client.end()
  }
}
