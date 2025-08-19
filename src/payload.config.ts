// storage-adapter-import-placeholder
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Documents } from './collections/Documents'
import { Settings } from './globals/Settings'
import { FetchAirtableDocuments } from './tasks/fetchAirtableDocuments'
import { airtableWorkflow } from './workflows/airtableWorkflow'
import { DownloadDocuments } from './tasks/downloadDocuments'
import { ExtractDocuments } from './tasks/extractDocuments'
import { AISummarizer } from './tasks/aiSummarizer'
import { UploadToMeedan } from './tasks/uploadToMeedan'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
// check if is prod env
const isProd = process.env.NODE_ENV === 'production'

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Documents],
  globals: [Settings],
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
    tasks: [
      FetchAirtableDocuments,
      DownloadDocuments,
      ExtractDocuments,
      AISummarizer,
      UploadToMeedan,
    ],
    workflows: [airtableWorkflow],
    autoRun: [
      {
        cron: '* * * * *',
        queue: 'everyMinute',
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
