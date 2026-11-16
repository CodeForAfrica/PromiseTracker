import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'
import { buildConfig } from 'payload'

import { databaseUrl } from './env'
import { migrations } from './migrations'
import { storageAdapters } from './storage'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** `web` serves the site, admin and API. `worker` also runs background jobs. */
const role = process.env.PT_ROLE === 'worker' ? 'worker' : 'web'

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: dirname,
      importMapFile: path.resolve(dirname, '../../site/src/app/(payload)/admin/importMap.js'),
    },
  },
  db: postgresAdapter({
    idType: 'uuid',
    migrationDir: path.resolve(dirname, 'migrations'),
    // Every schema change goes through a committed migration, in development too.
    push: false,
    // In production, pending migrations run when Payload starts, before the
    // server takes traffic.
    prodMigrations: migrations,
    pool: { connectionString: databaseUrl() },
  }),
  editor: lexicalEditor(),
  jobs: {
    // Safe with several worker replicas: Payload 4 claims each job with a
    // processing token and lease before running it, so no two workers run the
    // same job.
    autoRun: role === 'worker' ? [{ cron: '* * * * *', allQueues: true }] : [],
  },
  plugins: [corePlugin(), sitePlugin()],
  secret: process.env.PAYLOAD_SECRET ?? '',
  storage: storageAdapters(),
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
