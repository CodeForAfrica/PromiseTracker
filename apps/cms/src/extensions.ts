import pg from 'pg'

import { databaseUrl } from './env'

const REQUIRED = ['unaccent', 'pg_trgm'] as const

/**
 * Start-up refuses to run without the Postgres extensions search needs
 * (section 16.2). The first migration installs them, so a gap here means the
 * database was changed by hand or migrations have not run.
 */
export async function assertExtensions(): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl() })
  await client.connect()
  try {
    const { rows } = await client.query<{ extname: string }>(
      'select extname from pg_extension where extname = any($1)',
      [REQUIRED],
    )
    const installed = new Set(rows.map((r) => r.extname))
    const missing = REQUIRED.filter((name) => !installed.has(name))
    if (missing.length > 0) {
      throw new Error(
        `Postgres is missing the ${missing.join(' and ')} extension. Run the migrations, or ` +
          'install it with CREATE EXTENSION.',
      )
    }
  } finally {
    await client.end()
  }
}
