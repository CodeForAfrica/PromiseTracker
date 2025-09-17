import { AxApacheTika } from "@ax-llm/ax";
import { TaskConfig } from "payload";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { Media } from "@/payload-types";

const tika = new AxApacheTika();

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

      logger.info("extractDocuments:: Documents to extract", {
        count: documents.length,
      });

      const processedDocs = [];

      for (const doc of documents) {
        try {
          if (!doc.files?.length) {
            logger.warn("extractDocuments:: Document has no file attachment", {
              id: doc.id,
            });
            continue;
          }

          const files = doc.files as Media[];
          const text = [];
          let hasExtractedText = false;

          for (const file of files) {
            const filePath = join(process.cwd(), "media", file.filename!);
            if (!existsSync(filePath)) {
              logger.warn("extractDocuments:: File not found on disk", {
                id: doc.id,
                filePath,
              });
              continue;
            }
            const extractedText = await extractTextFromDoc(filePath);

            if (extractedText.length === 0) {
              logger.warn(
                "extractDocuments:: No text extracted from document",
                {
                  id: doc.id,
                }
              );
              continue;
            }

            logger.info("extractDocuments:: Successfully extracted text", {
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
          }

          if (!hasExtractedText) {
            logger.warn(
              "extractDocuments:: Skipping document update - no readable text",
              { id: doc.id }
            );
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

          logger.info(
            "extractDocuments:: Updated document with extracted text",
            { id: doc.id }
          );
        } catch (docError) {
          logger.error(
            "extractDocuments:: Error processing individual document",
            {
              id: doc.id,
              error:
                docError instanceof Error ? docError.message : String(docError),
            }
          );
        }
      }

      logger.info("extractDocuments:: Text extraction completed", {
        processed: processedDocs.length,
        total: documents.length,
      });

      return {
        output: {},
      };
    } catch (error) {
      logger.error("extractDocuments:: Error in document extraction task", {
        error,
      });
      throw error;
    }
  },
};
