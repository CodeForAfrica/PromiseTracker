import type { Payload } from 'payload'
import pg from 'pg'

import { assertRuntimeEnv, databaseUrl } from './env'
import { getPayload } from './getPayload'

// Any fixed number. Every PromiseTracker process uses the same one.
const MIGRATION_LOCK_KEY = 6_410_663
// Postgres's error code for a lock wait that hit lock_timeout.
const LOCK_NOT_AVAILABLE = '55P03'

const lockTimeoutSeconds = (env: NodeJS.ProcessEnv = process.env): number => {
  const value = Number(env.PT_STARTUP_LOCK_TIMEOUT_SECONDS)
  return Number.isInteger(value) && value > 0 ? value : 300
}

const isLockTimeout = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && Reflect.get(error, 'code') === LOCK_NOT_AVAILABLE

/**
 * Starts Payload when a server starts. In production Payload applies pending
 * migrations as it starts, and its Postgres adapter takes no lock, so replicas
 * starting together could run the same migration twice. A Postgres advisory
 * lock lets one process start Payload at a time. The rest wait, then find
 * nothing left to migrate.
 *
 * The wait is bounded, so a replica stuck mid-migration makes the others fail
 * with a clear message instead of waiting forever.
 */
export async function startPayload(): Promise<Payload> {
  assertRuntimeEnv()
  if (process.env.NODE_ENV !== 'production') return getPayload()

  const timeout = lockTimeoutSeconds()
  const client = new pg.Client({ connectionString: databaseUrl() })
  await client.connect()
  try {
    // lock_timeout bounds waits for advisory locks too. SET cannot take a
    // parameter, and the value is an integer we built, so it is inlined.
    await client.query(`set lock_timeout = '${timeout}s'`)
    try {
      await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY])
    } catch (error) {
      if (!isLockTimeout(error)) throw error
      throw new Error(
        `Another PromiseTracker process held the start-up lock for over ${timeout}s, so ` +
          'migrations may be stuck. Check the other replicas, or raise PT_STARTUP_LOCK_TIMEOUT_SECONDS.',
      )
    }
    return await getPayload()
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]).catch(() => {})
    await client.end()
  }
}
