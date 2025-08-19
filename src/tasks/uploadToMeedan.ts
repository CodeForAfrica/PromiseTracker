import { TaskConfig } from 'payload'
import { createFactCheckClaim } from '@/lib/meedan'

export const UploadToMeedan: TaskConfig<'uploadToMeedan'> = {
  slug: 'uploadToMeedan',
  label: 'Upload To Meedan',
  schedule: [
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
      const settings = await payload.findGlobal({
        slug: 'settings',
      })

      const meedanAPIKey = settings?.meedan?.meedanAPIKey
      const teamId = settings?.meedan?.teamId

      if (!meedanAPIKey || !teamId) {
        throw new Error('Meedan API key or team ID not configured in settings')
      }

      const { docs: documents } = await payload.find({
        collection: 'documents',
        where: {
          fullyProcessed: {
            equals: false,
          },
        },
        limit: -1,
        depth: 0,
      })

      logger.info(`Found ${documents.length} documents to process`)

      if (documents.length === 0) {
        return {
          output: {
            message: 'No documents found that need processing',
            processed: 0,
            errors: 0,
          },
        }
      }

      let processedCount = 0
      let errorCount = 0
      const errors: Array<{ documentId: string; error: string }> = []

      // Process each document
      for (const doc of documents) {
        try {
          logger.info(`Processing document: ${doc.id} - ${doc.title}`)

          // Validate that document has AI extraction data
          if (
            !doc.aiExtraction ||
            !Array.isArray(doc.aiExtraction) ||
            doc.aiExtraction.length === 0
          ) {
            logger.warn(`Document ${doc.id} has no AI extraction data, skipping`)
            continue
          }

          // Extract and format the AI extraction data
          const aiTitle = doc.aiTitle || doc.title

          // Filter extractions that haven't been uploaded yet
          const aiExtractions = doc.aiExtraction
            .filter((extraction) => !extraction.checkMediaId)
            .map(({ category, summary, source, uniqueId }) => ({
              category,
              summary,
              source,
              uniqueId,
            }))

          if (aiExtractions.length === 0) {
            logger.info(`Document ${doc.id} has no unprocessed AI extractions, skipping`)
            continue
          }

          let extractionProcessedCount = 0
          let extractionErrorCount = 0

          // Process each extraction individually
          for (const extraction of aiExtractions) {
            try {
              logger.info(
                `Uploading extraction ${extraction.uniqueId} from document ${doc.id} to CheckMedia`,
              )

              // Generate tags from document metadata + extraction category
              const tags = [
                doc.politicalEntity,
                doc.country,
                doc.region,
                doc.type?.toUpperCase(),
                extraction.category,
              ].filter(Boolean) as string[]

              const quote = `
              ${extraction.summary} \n
              ${extraction.source}
              `.trim()

              const response = await createFactCheckClaim({
                apiKey: meedanAPIKey,
                teamId,
                quote: quote,
                tags,
                claimDescription: extraction.summary,
                factCheck: {
                  title: extraction.summary,
                  url: doc.url || '',
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

              // Find and update the extraction by uniqueId instead of index
              const updatedAiExtraction = doc.aiExtraction.map((ext) => {
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

              extractionProcessedCount++
              logger.info(
                `Updated extraction ${extraction.uniqueId} in document ${doc.id} with CheckMedia data`,
              )
            } catch (error) {
              extractionErrorCount++
              const errorMessage = error instanceof Error ? error.message : 'Unknown error'
              logger.error(
                `Error uploading extraction ${extraction.uniqueId} from document ${doc.id}:`,
                error,
              )
              errors.push({
                documentId: `${doc.id}-extraction-${extraction.uniqueId}`,
                error: errorMessage,
              })
            }
          }

          // Check if all extractions have been processed (have checkMediaId)
          const updatedDoc = await payload.findByID({
            collection: 'documents',
            id: doc.id,
          })

          const allExtractionsProcessed = updatedDoc.aiExtraction?.every(
            (extraction: any) => extraction.checkMediaId,
          )

          if (allExtractionsProcessed) {
            // Mark document as fully processed
            await payload.update({
              collection: 'documents',
              id: doc.id,
              data: {
                fullyProcessed: true,
              },
            })
            logger.info(`Document ${doc.id} marked as fully processed - all extractions uploaded`)
          }

          processedCount++
          logger.info(
            `Processed ${extractionProcessedCount} extractions from document ${doc.id} with ${extractionErrorCount} errors`,
          )
        } catch (error) {
          errorCount++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          logger.error(`Error processing document ${doc.id}:`, error)
          errors.push({
            documentId: doc.id,
            error: errorMessage,
          })
        }
      }

      const result = {
        message: `Processed ${processedCount} documents successfully${errorCount > 0 ? ` with ${errorCount} errors` : ''}`,
        processed: processedCount,
        errors: errorCount,
        errorDetails: errors.length > 0 ? errors : undefined,
      }

      logger.info('uploadToMeedan task completed', result)

      return {
        output: 'result',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('uploadToMeedan task failed:', error)

      return {
        output: {
          message: `Task failed: ${errorMessage}`,
          processed: 0,
          errors: 1,
          errorDetails: [{ documentId: 'N/A', error: errorMessage }],
        },
      }
    }
  },
}
