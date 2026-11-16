/**
 * Settings with development defaults. The defaults match docker/compose.yaml,
 * so `pnpm services` and an env file that only moves a port are enough to run
 * the app and the tests. Production must set every value.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL
  if (env.NODE_ENV === 'production') return ''
  const user = env.PT_POSTGRES_USER ?? 'promisetracker'
  const password = env.PT_POSTGRES_PASSWORD ?? 'promisetracker'
  const db = env.PT_POSTGRES_DB ?? 'promisetracker'
  const port = env.PT_POSTGRES_PORT ?? '5432'
  return `postgres://${user}:${password}@localhost:${port}/${db}`
}

/**
 * Fails at start-up, with the names of what is missing, rather than later with
 * a vaguer error from Payload or the database driver.
 */
export function assertRuntimeEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing: string[] = []
  if (!env.PAYLOAD_SECRET) missing.push('PAYLOAD_SECRET')
  if (env.NODE_ENV === 'production' && !env.DATABASE_URL) missing.push('DATABASE_URL')
  if (missing.length > 0) {
    throw new Error(`Missing settings: ${missing.join(', ')}. See .env.example.`)
  }
}
