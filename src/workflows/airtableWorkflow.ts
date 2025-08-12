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
  handler: async ({ tasks, req }) => {
    const { payload } = req
    const logger = payload.logger
    const fetchResult = await tasks.fetchAirtableDocuments(randomUUID(), {})

    const docsToDownload = fetchResult?.docs?.map((doc) => ({ id: doc.id })) || []
    if (docsToDownload.length === 0) {
      logger.info('No new documents to download')
      return
    }

    const downloadResult = await tasks.downloadDocuments(randomUUID(), {
      input: { docs: docsToDownload },
    })

    if (!downloadResult?.docs?.length) {
      logger.info('No documents to extract')
      return
    }

    const docsToExtract = downloadResult.docs.filter((doc) => doc.id) as { id: string }[]

    const extractionResult = await tasks.extractDocuments(randomUUID(), {
      input: { docs: docsToExtract },
    })

    if (!extractionResult?.docs?.length) {
      logger.info('No documents to extract')
      return
    }

    const aiResult = await tasks.aiSummarizer(randomUUID(), {
      input: { docs: extractionResult.docs },
    })

    logger.info(`Successfully processed ${docsToExtract.length} documents`)
  },
}
