import { WorkflowConfig } from 'payload'
import { randomUUID } from 'node:crypto'

export const airtableWorkflow: WorkflowConfig = {
  slug: 'airtableWorkflow',
  label: 'Airtable Workflow',
  schedule: [
    {
      cron: '* * * * *',
      queue: 'everyMinute',
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
