import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { defineFinalPlugin } from '@promisetracker/kernel'
import { installAfterCommit, privateHistory, setTagRefresher } from '@promisetracker/plugin-core'
import { buildConfig } from 'payload'
import { createHttpRefresher } from './cache'
import { emailAdapter } from './email'
import { databaseUrl } from './env'
import { assertExtensions } from './extensions'
import { ensureFirstAdmin } from './firstAdmin'
import { kernel } from './kernel'
import { defaultLocale, registeredLocales } from './locales'
import { loggerConfig } from './logger'
import { migrations } from './migrations'
import { reportError } from './sentry'
import { storageAdapters } from './storage'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** `web` serves the site, admin and API. `worker` also runs background jobs. */
const role = process.env.PT_ROLE === 'worker' ? 'worker' : 'web'
const email = emailAdapter()

// A change to a public record refreshes the site's cached pages (section 17).
setTagRefresher(createHttpRefresher())

const inUse = new Set(kernel.locales.map((l) => l.code))

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
  ...(email ? { email } : {}),
  localization: {
    // Every registered language is in the schema, so PT_LOCALES never needs a
    // migration. The admin shows only the ones PT_LOCALES switches on (D45).
    locales: registeredLocales.map((l) => ({ code: l.code, label: l.label, rtl: 'rtl' in l })),
    defaultLocale,
    // A missing translation stays missing. English never fills a French page (D30).
    fallback: false,
    filterAvailableLocales: ({ locales }) => locales.filter((l) => inUse.has(l.code)),
  },
  // Guests read through /api/v1 only, and nothing here uses GraphQL (D46).
  graphQL: { disable: true },
  hooks: {
    // Errors Payload catches in its routes and operations never reach Next.js's
    // onRequestError, so they are reported here. Only a developer's go to Sentry.
    afterError: [
      ({ error, collection, req }) => {
        reportError(error, { collection: collection?.slug, method: req.method })
      },
    ],
  },
  jobs: {
    // Safe with several worker replicas: Payload 4 claims each job with a
    // processing token and lease before running it, so no two workers run the
    // same job.
    autoRun: role === 'worker' ? [{ cron: '* * * * *', allQueues: true }] : [],
  },
  logger: loggerConfig(),
  // Start-up checks that need a running Payload (section 4.4). Payload applies
  // pending migrations before this, and migration commands skip it.
  onInit: async (payload) => {
    // First, so a cache refresh waits for its save to commit (section 17).
    installAfterCommit(payload)
    await assertExtensions()
    await kernel.onInit(payload)
    await ensureFirstAdmin(payload)
  },
  // privateHistory runs after every plugin, so it covers all their record types.
  plugins: [...kernel.payloadPlugins, defineFinalPlugin('private-history', privateHistory)],
  secret: process.env.PAYLOAD_SECRET ?? '',
  storage: storageAdapters(),
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
