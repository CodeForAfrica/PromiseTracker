import { execFileSync } from 'node:child_process'
import { connect } from 'node:net'

import { databaseUrl } from '@promisetracker/cms/env'
import pg from 'pg'

type Env = Readonly<Record<string, string | undefined>>

/** Each suite gets its own database, so integration and browser runs never meet. */
export type Suite = 'int' | 'e2e'

export class UnsafeTestDatabaseError extends Error {
  override name = 'UnsafeTestDatabaseError'
}

// The machine itself, or the Postgres service in Compose.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', 'postgres'])
const TEST_NAME = /^[a-z0-9_]+_test$/

const nameOf = (url: URL): string => decodeURIComponent(url.pathname.replace(/^\//, ''))

/**
 * The test suite's database: the development database's name with
 * `_<suite>_test` added, on the same server. A URL that already names that
 * database is kept, so calling this again in a child process changes nothing.
 */
export function testDatabaseUrl(suite: Suite, env: Env = process.env): string {
  const url = new URL(databaseUrl(env))
  const name = nameOf(url) || 'promisetracker'
  const suffix = `_${suite}_test`
  if (!name.endsWith(suffix)) url.pathname = `/${name}${suffix}`
  return url.toString()
}

/**
 * Refuses any database a test could damage: one on another machine, or one
 * whose name does not end in `_test`. Test set-up drops and recreates the
 * database, so this check is what keeps it away from real data.
 * Returns the database name.
 */
export function assertTestDatabase(raw: string | undefined): string {
  let url: URL
  try {
    url = new URL(raw ?? '')
  } catch {
    throw new UnsafeTestDatabaseError('The test database URL is missing or not a URL.')
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new UnsafeTestDatabaseError(
      `Tests only use a local database, not one on ${url.hostname}. Point DATABASE_URL at ` +
        'the Postgres from `pnpm services`.',
    )
  }
  const name = nameOf(url)
  if (!TEST_NAME.test(name)) {
    throw new UnsafeTestDatabaseError(
      `Tests only use a database named like "promisetracker_int_test", not "${name}".`,
    )
  }
  return name
}

/**
 * Points this process, and every process it starts, at the suite's database.
 * Call it after the env files are loaded.
 */
export function switchToTestDatabase(suite: Suite): string {
  const url = testDatabaseUrl(suite)
  assertTestDatabase(url)
  process.env.DATABASE_URL = url
  return url
}

const reachable = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host, port, timeout: 2000 })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.once('timeout', () => done(false))
  })

/**
 * Drops and recreates the test database, then applies the committed
 * migrations, so every run starts from the same empty schema.
 */
export async function prepareTestDatabase(url: string): Promise<void> {
  const name = assertTestDatabase(url)
  const server = new URL(url)
  const port = Number(server.port || 5432)
  if (!(await reachable(server.hostname, port))) {
    throw new Error(
      `Postgres is not reachable at ${server.hostname}:${port}. Start it with \`pnpm services\`, ` +
        'or set PT_POSTGRES_PORT or DATABASE_URL in .env.local.',
    )
  }
  // A database cannot drop itself, so connect to the server's default one.
  server.pathname = '/postgres'
  const client = new pg.Client({ connectionString: server.toString() })
  await client.connect()
  try {
    // The name is safe to quote: assertTestDatabase allows only [a-z0-9_].
    await client.query(`drop database if exists "${name}" with (force)`)
    await client.query(`create database "${name}"`)
  } finally {
    await client.end()
  }
  execFileSync('pnpm', ['migrate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  })
}
