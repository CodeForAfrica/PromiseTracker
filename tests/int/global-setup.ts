import '../load-env'

import { execFileSync } from 'node:child_process'
import { connect } from 'node:net'

import { databaseUrl } from '@promisetracker/cms/env'

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

/** Brings the test database up to the committed migrations before any test runs. */
export default async function setup(): Promise<void> {
  const url = new URL(databaseUrl())
  const port = Number(url.port || 5432)
  if (!(await reachable(url.hostname, port))) {
    throw new Error(
      `Postgres is not reachable at ${url.hostname}:${port}. Start it with \`pnpm services\`, ` +
        'or set PT_POSTGRES_PORT or DATABASE_URL in .env.local.',
    )
  }
  execFileSync('pnpm', ['migrate'], { stdio: 'inherit' })
}
