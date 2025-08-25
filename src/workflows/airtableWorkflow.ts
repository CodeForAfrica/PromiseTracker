import { WorkflowConfig } from 'payload'
import { randomUUID } from 'node:crypto'
import { isProd } from '@/utils/utils'

export const airtableWorkflow: WorkflowConfig = {
  slug: 'airtableWorkflow',
  label: 'Airtable Workflow',
  schedule: [
    {
      cron: isProd ? '0 * * * *' : '* * * * *',
      queue: isProd ? 'hourly' : 'everyMinute',
    },
  ],
  handler: async ({ tasks }) => {
    await tasks.fetchAirtableDocuments(randomUUID(), {
      input: [],
    })
    await tasks.downloadDocuments(randomUUID(), {
      input: [],
    })
    await tasks.extractDocuments(randomUUID(), {
      input: [],
    })
    await tasks.aiExtractor(randomUUID(), {
      input: [],
    })
    await tasks.uploadToMeedan(randomUUID(), {
      input: [],
    })
  },
}
