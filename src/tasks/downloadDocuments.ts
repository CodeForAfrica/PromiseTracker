import { TaskConfig } from 'payload'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { mimeToExtension } from '@/utils/files'

const fileName = fileURLToPath(import.meta.url)
const dirName = dirname(fileName)
const tempDir = join(dirName, '..', '..', 'temp')

export const DownloadDocuments: TaskConfig<'downloadDocuments'> = {
  retries: 2,
  slug: 'downloadDocuments',
  label: 'Download Documents',
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

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    logger.debug('Downloading documents', { count: docs?.length || 0 })

    if (!docs?.length) {
      logger.info('No documents to download')
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
          url: true,
          docURL: true,
        },
      })

      const processedDocs = []

      for (const doc of documents) {
        try {
          logger.debug('Processing document', { id: doc.id })
          const { url, docURL } = doc

          // priritize file uploaded to airtable
          const urlToFetch = docURL || url

          if (!urlToFetch) {
            logger.warn('Document has no URL', { id: doc.id })
            continue
          }

          const res = await fetch(urlToFetch)

          if (!res.ok) {
            throw new Error(`Failed to fetch document: ${res.status} ${res.statusText}`)
          }

          const buffer = await res.arrayBuffer()
          const contentType = res.headers.get('content-type')?.split(';')[0] || ''
          const extension = mimeToExtension[contentType] || ''
          const docFileName = `${doc.id}${extension}`
          const filePath = join(tempDir, docFileName)

          await writeFile(filePath, Buffer.from(buffer), { flag: 'w' })

          const mediaUpload = await payload.create({
            collection: 'media',
            data: {
              alt: docFileName,
            },
            filePath,
          })

          await payload.update({
            collection: 'documents',
            id: doc.id,
            data: {
              file: mediaUpload,
            },
          })

          await unlink(filePath)
          logger.debug('Document processed successfully', { id: doc.id })
          processedDocs.push({ id: doc.id })
        } catch (docError) {
          logger.error('Error processing document', {
            id: doc.id,
            error: docError instanceof Error ? docError.message : String(docError),
          })
        }
      }

      logger.info(`Successfully processed ${processedDocs.length} of ${documents.length} documents`)
      return {
        output: {
          docs: processedDocs.length ? processedDocs : docs,
        },
      }
    } catch (error) {
      logger.error('Error in document download task', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
}
