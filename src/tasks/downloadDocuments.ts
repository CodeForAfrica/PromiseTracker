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
  handler: async ({ req }) => {
    const { payload } = req
    const logger = payload.logger
    logger.info('downloadDocuments:: Starting Downloading of Documents')

    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true })
    }

    try {
      const { docs: documents } = await payload.find({
        collection: 'documents',
        where: {
          file: {
            exists: false,
          },
        },
        select: {
          title: true,
          url: true,
          docURL: true,
        },
      })

      if (documents.length === 0) {
        logger.info('downloadDocuments:: No documents to download')
        return { output: {} }
      }

      logger.info(`downloadDocuments:: Downloading ${documents.length} documents`)

      const processedDocs = []

      for (const doc of documents) {
        try {
          logger.info('downloadDocuments:: Processing document', { title: doc.title })
          const { url, docURL } = doc

          // prioritise file uploaded to airtable
          const urlToFetch = docURL || url

          if (!urlToFetch) {
            logger.warn('downloadDocuments:: Document has no URL', { title: doc.title })
            continue
          }

          const res = await fetch(urlToFetch)

          if (!res.ok) {
            logger.error(
              `downloadDocuments:: Failed to fetch document ${doc.title}: ${res.status} ${res.statusText}`,
            )
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
          logger.info('downloadDocuments:: Document processed successfully', { title: doc.title })
          processedDocs.push({ id: doc.id })
        } catch (docError) {
          logger.error('downloadDocuments:: Error processing document', {
            id: doc.id,
            error: docError instanceof Error ? docError.message : String(docError),
          })
        }
      }

      logger.info(
        `downloadDocuments:: Successfully processed ${processedDocs.length} of ${documents.length} documents`,
      )
      return {
        output: {},
      }
    } catch (error) {
      logger.error('downloadDocuments:: Error in document download task', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  },
}
