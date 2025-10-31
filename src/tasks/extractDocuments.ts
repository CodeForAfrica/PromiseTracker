import { AxApacheTika } from "@ax-llm/ax";
import { TaskConfig } from "payload";
import { existsSync, readFileSync } from "fs";
import { unlink } from "fs/promises";
import { join } from "path";
import { Media } from "@/payload-types";
import { downloadFile } from "@/utils/files";

const tika = new AxApacheTika({
  url: process.env.AX_APACHE_TIKA_URL ?? "http://127.0.0.1:9998/",
});

export function cleanText(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .trim();
}

export async function extractTextFromDoc(filePath: string): Promise<string[]> {
  const fileBuffer = readFileSync(filePath);
  const text = await tika.convert([new Blob([fileBuffer])]);
  return text.map(cleanText);
}

export const ExtractDocuments: TaskConfig<"extractDocuments"> = {
  slug: "extractDocuments",
  label: "Extract Documents",
  handler: async ({ req }) => {
    const { payload } = req;
    const logger = payload.logger;

    logger.info("extractDocuments:: Starting document text extraction");

    try {
      const { docs: documents } = await payload.find({
        collection: "documents",
        where: {
          "extractedText.text": {
            exists: false,
          },
        },
        select: {
          files: true,
        },
        depth: 3,
      });
      if (documents.length === 0) {
        logger.info("extractDocuments:: No documents to extract");
        return { output: {} };
      }

      logger.info({
        message: "extractDocuments:: Documents to extract",
        count: documents.length,
      });

      const processedDocs = [];

      for (const doc of documents) {
        try {
          if (!doc.files?.length) {
            logger.warn({
              message: "extractDocuments:: Document has no file attachment",
              id: doc.id,
            });
            continue;
          }

          const files = doc.files as Media[];
          const text = [];
          let hasExtractedText = false;

          for (const file of files) {
            const filePath = file.filename
              ? join(process.cwd(), "media", file.filename)
              : null;
            let fileInput: string | null = null;
            let tempFilePath: string | null = null;

            if (filePath && existsSync(filePath)) {
              logger.info(`File exist in: ${filePath}`);
              fileInput = filePath;
            } else if (file.url) {
              const url = `${process.env.NEXT_PUBLIC_APP_URL}${file.url}`;
              logger.info(
                `File does not exist in ${fileInput}. Downloading from ${url}`
              );
              try {
                tempFilePath = await downloadFile(url);
                console.log(`Tempfilepath: ${tempFilePath}`);
                fileInput = tempFilePath;

                logger.info({
                  message:
                    "extractDocuments:: Downloaded file from remote storage",
                  id: doc.id,
                  fileId: file.id,
                });
              } catch (downloadError) {
                logger.error({
                  message: "extractDocuments:: Error downloading remote file",
                  id: doc.id,
                  fileId: file.id,
                  error:
                    downloadError instanceof Error
                      ? downloadError.message
                      : String(downloadError),
                });
                continue;
              }
            } else {
              logger.warn({
                message:
                  "extractDocuments:: File unavailable locally and has no URL",
                id: doc.id,
                fileId: file.id,
              });
              continue;
            }

            try {
              const extractedText = await extractTextFromDoc(fileInput);

              if (extractedText.length === 0) {
                logger.warn({
                  message: "extractDocuments:: No text extracted from document",
                  id: doc.id,
                });
                continue;
              }

              logger.info({
                message: "extractDocuments:: Successfully extracted text",
                id: doc.id,
                textLength: extractedText.join("\n").length,
              });

              text.push({
                root: {
                  type: "root",
                  children: extractedText.map((line) => ({
                    children: [
                      {
                        text: line,
                        type: "text",
                      },
                    ],
                    type: "paragraph",
                  })),
                },
              });
              hasExtractedText = true;
            } finally {
              if (tempFilePath) {
                try {
                  await unlink(tempFilePath);
                } catch (cleanupError) {
                  logger.warn({
                    message: "extractDocuments:: Failed to delete temp file",
                    id: doc.id,
                    fileId: file.id,
                    error:
                      cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError),
                  });
                }
              }
            }
          }

          if (!hasExtractedText) {
            logger.warn({
              message:
                "extractDocuments:: Skipping document update - no readable text",
              id: doc.id,
            });
            continue;
          }

          await payload.update({
            collection: "documents",
            id: doc.id,
            data: {
              extractedText: text.map((t) => ({
                text: t,
              })),
            },
          });

          processedDocs.push({
            id: doc.id,
          });

          logger.info({
            message: "extractDocuments:: Updated document with extracted text",
            id: doc.id,
          });
        } catch (docError) {
          logger.error({
            message: "extractDocuments:: Error processing individual document",
            id: doc.id,
            error:
              docError instanceof Error ? docError.message : String(docError),
          });
        }
      }

      logger.info({
        message: "extractDocuments:: Text extraction completed",
        processed: processedDocs.length,
        total: documents.length,
      });

      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message: "extractDocuments:: Error in document extraction task",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
