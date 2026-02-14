import { TaskConfig } from "payload";
import { unlink } from "node:fs/promises";
import { downloadFile } from "@/utils/files";
import { Media } from "@/payload-types";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

export const DownloadDocuments: TaskConfig<"downloadDocuments"> = {
  retries: 2,
  slug: "downloadDocuments",
  label: "Download Documents",
  handler: withTaskTracing("downloadDocuments", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "downloadDocuments", input);
    logger.info("downloadDocuments:: Starting Downloading of Documents");

    try {
      const documentIds =
        (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [];
      const { docs: documents } = await payload.find({
        collection: "documents",
        where: {
          files: {
            exists: false,
          },
          ...(documentIds.length
            ? {
                id: {
                  in: documentIds,
                },
              }
            : {}),
        },
        select: {
          airtableID: true,
          title: true,
          url: true,
          docURLs: true,
        },
        limit: 0,
      });

      if (documents.length === 0) {
        logger.info("downloadDocuments:: No documents to download");
        return { output: {} };
      }

      logger.info(
        `downloadDocuments:: Downloading ${documents.length}. Documents:\n ${documents.map((t) => `${t.title}\n`)}`,
      );

      const processedDocs = [];

      for (const doc of documents) {
        try {
          logger.info({
            message: "downloadDocuments:: Processing document",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
          });
          const { url, docURLs } = doc;

          // prioritise file uploaded to airtable
          const urlsToFetch = (
            docURLs?.length ? docURLs.map((t) => t.url) : [url]
          ).filter((candidate): candidate is string => Boolean(candidate));

          if (urlsToFetch.length === 0) {
            logger.warn({
              message: "downloadDocuments:: Document has no URL",
              id: doc.id,
              airtableID: doc.airtableID,
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
              logger.warn({
                message: "downloadDocuments:: Failed to download URL",
                id: doc.id,
                airtableID: doc.airtableID,
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
            logger.warn({
              message:
                "downloadDocuments:: No files were downloaded for document",
              id: doc.id,
              airtableID: doc.airtableID,
              title: doc.title,
              attemptedURLs: urlsToFetch,
            });
            continue;
          }

          await payload.update({
            collection: "documents",
            id: doc.id,
            data: {
              files: files,
            },
          });

          logger.info({
            message: "downloadDocuments:: Document processed successfully",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
          });
          processedDocs.push({ id: doc.id });
        } catch (docError) {
          logger.error({
            message: "downloadDocuments:: Error processing document",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
            url: doc.url,
            docURLs: doc.docURLs?.map((entry) => entry.url),
            error:
              docError instanceof Error ? docError.message : String(docError),
          });
        }
      }

      logger.info(
        `downloadDocuments:: Successfully processed ${processedDocs.length} of ${documents.length} documents`,
      );
      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message: "downloadDocuments:: Error in document download task",
        requestedDocumentIds:
          (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [],
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
