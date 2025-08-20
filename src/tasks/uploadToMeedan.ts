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
  handler: async ({ req }) => {
    const { payload } = req
    const { logger } = payload

    logger.info('uploadToMeedan:: Starting uploadToMeedan task')

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

      if (documents.length === 0) {
        logger.info('uploadToMeedan:: No documents to upload to Meedan')
        return { output: {} }
      }

      logger.info(`uploadToMeedan:; Uploading ${documents.length} to Meedan`)

      for (const doc of documents) {
        logger.info(`uploadToMeedan:: Processing document: ${doc.id} - ${doc.title}`)

        const aiExtractions = getAIExtractionToUpload(doc)

        if (aiExtractions.length === 0) {
          logger.info(
            `uploadToMeedan:: Document ${doc.id} has no unprocessed AI extractions, skipping`,
          )
          continue
        }

        for (const extraction of aiExtractions) {
          logger.info(
            `uploadToMeedan:: Uploading extraction ${extraction.uniqueId} from document ${doc.id} to CheckMedia`,
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

          logger.info(
            `uploadToMeedan:: Successfully uploaded extraction ${extraction.uniqueId} to CheckMedia`,
            {
              checkMediaId,
              checkMediaURL,
            },
          )

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
            `uploadToMeedan:: Updated extraction ${extraction.uniqueId} in document ${doc.id} with CheckMedia data`,
          )
        }

        await checkAndMarkDocumentComplete(doc, payload)
      }

      return {
        output: {},
      }
    } catch (error) {
      logger.error('uploadToMeedan::  Uploading to Meedan failed:', { error })
      throw error
    }
  },
}
