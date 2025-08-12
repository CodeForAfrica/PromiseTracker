import { AxApacheTika } from '@ax-llm/ax'
import { TaskConfig } from 'payload'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { Media } from '@/payload-types'

const tika = new AxApacheTika()

export function cleanText(text: string): string {
  return text
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^\x00-\x7F]/g, '')
    .trim()
}

export async function extractTextFromDoc(filePath: string): Promise<string[]> {
  const fileBuffer = readFileSync(filePath)
  const text = await tika.convert([new Blob([fileBuffer])])
  return text.map(cleanText)
}

export const ExtractDocuments: TaskConfig<'extractDocuments'> = {
  slug: 'extractDocuments',
  label: 'Extract Documents',
  inputSchema: [
    {
      name: 'docs',
      type: 'array',
      fields: [
        {
          name: 'id',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
  outputSchema: [
    {
      name: 'docs',
      type: 'array',
      fields: [
        {
          name: 'id',
          type: 'text',
        },
      ],
    },
  ],
  handler: async ({ input, req }) => {
    const { docs } = input
    const { payload } = req
    const logger = payload.logger

    logger.debug('Starting document text extraction', { count: docs?.length || 0 })

    if (!docs?.length) {
      logger.info('No documents to extract')
      return { output: { docs: [] } }
    }

    try {
      const { docs: documents } = await payload.find({
        collection: 'documents',
        where: {
          id: {
            in: docs.map((doc) => doc.id),
          },
        },
        select: {
          file: true,
        },
        depth: 3,
      })

      logger.debug('Found documents with files', { count: documents.length })

      const processedDocs = []

      for (const doc of documents) {
        try {
          if (!doc.file) {
            logger.warn('Document has no file attachment', { id: doc.id })
            continue
          }

          const file = doc.file as Media
          const filePath = join(process.cwd(), 'media', file.filename!)

          if (!existsSync(filePath)) {
            logger.warn('File not found on disk', { id: doc.id, filePath })
            continue
          }

          const extractedText = await extractTextFromDoc(filePath)

          if (extractedText.length === 0) {
            logger.warn('No text extracted from document', { id: doc.id })
            continue
          }

          processedDocs.push({
            id: doc.id,
          })

          logger.debug('Successfully extracted text', {
            id: doc.id,
            textLength: extractedText.join('\n').length,
          })

          await payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              extractedText: {
                root: {
                  type: 'root',
                  children: extractedText.map((line) => ({
                    children: [
                      {
                        text: line,
                        type: 'text',
                      },
                    ],
                    type: 'paragraph',
                  })),
                },
              },
            },
          })

          logger.debug('Updated document with extracted text', { id: doc.id })
        } catch (docError) {
          logger.error('Error processing individual document', {
            id: doc.id,
            error: docError instanceof Error ? docError.message : String(docError),
          })
        }
      }

      logger.info('Text extraction completed', {
        processed: processedDocs.length,
        total: documents.length,
      })

      return {
        output: {
          docs: processedDocs.map((doc) => ({
            id: doc.id,
          })),
        },
      }
    } catch (error) {
      logger.error('Error in document extraction task', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
}
