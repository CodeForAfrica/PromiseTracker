import { TaskConfig } from "payload";
import { unlink } from "node:fs/promises";
import { downloadFile } from "@/utils/files";
import { Media } from "@/payload-types";

export const DownloadDocuments: TaskConfig<"downloadDocuments"> = {
  retries: 2,
  slug: "downloadDocuments",
  label: "Download Documents",
  handler: async ({ req }) => {
    const { payload } = req;
    const logger = payload.logger;
    logger.info("downloadDocuments:: Starting Downloading of Documents");

    try {
      const { docs: documents } = await payload.find({
        collection: "documents",
        where: {
          files: {
            exists: false,
          },
        },
        select: {
          title: true,
          url: true,
          docURLs: true,
        },
      });

      if (documents.length === 0) {
        logger.info("downloadDocuments:: No documents to download");
        return { output: {} };
      }

      logger.info(
        `downloadDocuments:: Downloading ${documents.length} documents`
      );

      const processedDocs = [];

      for (const doc of documents) {
        try {
          logger.info("downloadDocuments:: Processing document", {
            title: doc.title,
          });
          const { url, docURLs } = doc;

          // prioritise file uploaded to airtable
          const urlsToFetch = (docURLs?.length
            ? docURLs.map((t) => t.url)
            : [url]
          ).filter((candidate): candidate is string => Boolean(candidate));

          if (urlsToFetch.length === 0) {
            logger.warn("downloadDocuments:: Document has no URL", {
              title: doc.title,
            });
            continue;
          }

          const files: Media[] = [];
          for (const fileUrl of urlsToFetch) {
            try {
              const filePath = await downloadFile(fileUrl);
              const mediaUpload = await payload.create({
                collection: "media",
                data: {
                  alt: doc.title,
                },
                filePath,
              });
              files.push(mediaUpload);
              await unlink(filePath);
            } catch (downloadError) {
              logger.warn("downloadDocuments:: Failed to download URL", {
                title: doc.title,
                url: fileUrl,
                error:
                  downloadError instanceof Error
                    ? downloadError.message
                    : String(downloadError),
              });
            }
          }

          if (files.length === 0) {
            logger.warn(
              "downloadDocuments:: No files were downloaded for document",
              {
                title: doc.title,
              }
            );
            continue;
          }

          await payload.update({
            collection: "documents",
            id: doc.id,
            data: {
              files: files,
            },
          });

          logger.info("downloadDocuments:: Document processed successfully", {
            title: doc.title,
          });
          processedDocs.push({ id: doc.id });
        } catch (docError) {
          logger.error("downloadDocuments:: Error processing document", {
            id: doc.id,
            error:
              docError instanceof Error ? docError.message : String(docError),
          });
        }
      }

      logger.info(
        `downloadDocuments:: Successfully processed ${processedDocs.length} of ${documents.length} documents`
      );
      return {
        output: {},
      };
    } catch (error) {
      logger.error("downloadDocuments:: Error in document download task", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
