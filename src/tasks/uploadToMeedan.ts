import { BasePayload, TaskConfig } from 'payload'
import { createFactCheckClaim } from '@/lib/meedan'
import { markDocumentAsProcessed } from '@/lib/airtable'
import { Document, Media } from '@/payload-types'

const getDocumentsToProcess = async (payload: BasePayload): Promise<Document[]> => {
  const { docs: documents } = await payload.find({
    collection: 'documents',
    where: {
      fullyProcessed: {
        equals: false,
      },
    },
    limit: -1,
    depth: 2,
  })
  return documents
}

const getAIExtractionToUpload = (doc: Document) => {
  return (
    doc.aiExtraction
      ?.filter((extraction) => !extraction.checkMediaId)
      .map(({ category, summary, source, uniqueId }) => ({
        category,
        summary,
        source,
        uniqueId,
      })) || []
  )
}

const checkAndMarkDocumentComplete = async (doc: Document, payload: BasePayload): Promise<void> => {
  const updatedDoc = await payload.findByID({
    collection: 'documents',
    id: doc.id,
  })

  const allExtractionsProcessed = updatedDoc.aiExtraction?.every(
    (extraction) => extraction.checkMediaId,
  )

  if (allExtractionsProcessed) {
    await payload.update({
      collection: 'documents',
      id: doc.id,
      data: { fullyProcessed: true },
    })

    if (doc.airtableID) {
      const {
        airtable: { airtableAPIKey },
      } = await payload.findGlobal({
        slug: 'settings',
      })

      await markDocumentAsProcessed({
        airtableAPIKey,
        airtableID: doc.airtableID,
      })
    }
  }
}

export const UploadToMeedan: TaskConfig<'uploadToMeedan'> = {
  slug: 'uploadToMeedan',
  label: 'Upload To Meedan',
  schedule: [
    // TODO:(@kelvinkipruto): Provide correct schedule: This is for testing only
    {
      cron: '* * * * *',
      queue: 'everyMinute',
    },
  ],
  handler: async ({ req }) => {
    const { payload } = req
    const { logger } = payload

    logger.info('Starting uploadToMeedan task')

    try {
      const {
        meedan: { meedanAPIKey, teamId },
      } = await payload.findGlobal({
        slug: 'settings',
      })

      if (!meedanAPIKey || !teamId) {
        throw new Error('Meedan API key or team ID not configured in settings')
      }

      const documents = await getDocumentsToProcess(payload)

      let processedCount = 0

      for (const doc of documents) {
        logger.info(`Processing document: ${doc.id} - ${doc.title}`)

        const aiExtractions = getAIExtractionToUpload(doc)

        if (aiExtractions.length === 0) {
          logger.info(`Document ${doc.id} has no unprocessed AI extractions, skipping`)
          continue
        }

        for (const extraction of aiExtractions) {
          logger.info(
            `Uploading extraction ${extraction.uniqueId} from document ${doc.id} to CheckMedia`,
          )

          const tags = [
            doc.politicalEntity,
            doc.country,
            doc.region,
            doc.type?.toUpperCase(),
            extraction.category,
          ].filter(Boolean) as string[]

          const quote = `${extraction.summary} \n\n${extraction.source}`.trim()

          const downloadedFile = doc.file as Media

          const response = await createFactCheckClaim({
            apiKey: meedanAPIKey,
            teamId,
            quote: quote,
            tags,
            claimDescription: extraction.summary,
            factCheck: {
              title: extraction.summary,
              url: doc.url || downloadedFile.url || doc.docURL || '',
              language: doc.language || '',
              publish_report: false,
            },
          })

          const checkMediaId = response.data.createProjectMedia.project_media.id
          const checkMediaURL = response.data.createProjectMedia.project_media.full_url

          logger.info(`Successfully uploaded extraction ${extraction.uniqueId} to CheckMedia`, {
            checkMediaId,
            checkMediaURL,
          })

          const updatedAiExtraction = doc.aiExtraction?.map((ext) => {
            if (ext.uniqueId === extraction.uniqueId) {
              return {
                ...ext,
                checkMediaId,
                checkMediaURL,
              }
            }
            return ext
          })

          await payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              aiExtraction: updatedAiExtraction,
            },
          })

          logger.info(
            `Updated extraction ${extraction.uniqueId} in document ${doc.id} with CheckMedia data`,
          )
        }

        await checkAndMarkDocumentComplete(doc, payload)

        processedCount++
      }

      const result = {
        message: `Processed ${processedCount} documents}`,
        processed: processedCount,
      }

      logger.info('uploadToMeedan task completed', result)

      return {
        output: result,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('uploadToMeedan task failed:', error)

      return {
        output: {
          message: `Task failed: ${errorMessage}`,
          processed: 0,
        },
      }
    }
  },
  outputSchema: [
    {
      name: 'message',
      type: 'text',
      required: true,
    },
    {
      name: 'processed',
      type: 'number',
      required: true,
    },
  ],
}
