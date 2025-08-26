// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { Users } from '@/collections/Users'
import { collections } from '@/collections'
import { globals } from '@/globals'
import { tasks } from '@/tasks'
import { workflows } from '@/workflows'
import { isProd } from '@/utils/utils'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections,
  globals,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  sharp,
  plugins: [],
  jobs: {
    // For debugging in Admin
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      if (!defaultJobsCollection.admin) {
        defaultJobsCollection.admin = {}
      }

      defaultJobsCollection.admin.hidden = isProd
      return defaultJobsCollection
    },
    addParentToTaskLog: true,
    tasks,
    workflows,
    autoRun: [
      {
        cron: isProd ? '0 * * * *' : '* * * * *',
        queue: isProd ? 'hourly' : 'everyMinute',
      },
    ],
  },
  onInit: async (payload) => {
    await payload.jobs.queue({
      workflow: 'airtableWorkflow',
      input: {},
    })
  },
})
