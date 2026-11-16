import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'

import { databaseUrl } from './env'
import { assertExtensions } from './extensions'
import { kernel } from './kernel'
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
  // Guests read through /api/v1 only, and nothing here uses GraphQL (D46).
  graphQL: { disable: true },
  jobs: {
    // Safe with several worker replicas: Payload 4 claims each job with a
    // processing token and lease before running it, so no two workers run the
    // same job.
    autoRun: role === 'worker' ? [{ cron: '* * * * *', allQueues: true }] : [],
  },
  // Start-up checks that need a running Payload (section 4.4). Payload applies
  // pending migrations before this, and migration commands skip it.
  onInit: async (payload) => {
    await assertExtensions()
    await kernel.onInit(payload)
  },
  plugins: [...kernel.payloadPlugins],
  secret: process.env.PAYLOAD_SECRET ?? '',
  storage: storageAdapters(),
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
