import { TaskConfig } from "payload";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

export const ExtractPromises: TaskConfig<"extractPromises"> = {
  slug: "extractPromises",
  label: "Extract Promises",
  handler: withTaskTracing("extractPromises", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "extractPromises", input);
    logger.info("extractPromises:: Starting promise extraction");

    try {
      const {
        ai: { model: defaultModel, apiKey },
      } = await payload.findGlobal({
        slug: "settings",
      });

      const google = createGoogleGenerativeAI({
        apiKey: apiKey,
      });

      const model = google(defaultModel);

      const systemPrompt = `
    You are a helpful assistant that analyzes documents to extract campaign promises and provide structured summaries.
    Your task is to identify and categorize campaign promises, providing direct quotations as sources.
    `;

      const prompt = `
    Analyze the following document and extract campaign promises with the following structure:

    **Requirements:**
    1. **Title**: Infer an appropriate title from the document content.
    2. **Promises**: For each promise identified, provide:
       - **Category**: The thematic category of the promise (e.g., "Economy," "Healthcare," "Infrastructure," "Education," "Social Policy," etc.)
       - **Summary**: A concise summarization of the promise in your own words
       - **Source**: Direct quotations from the text that support this promise. Include multiple quotes if the promise is mentioned in different parts of the document.

    **Guidelines:**
    - Only include specific, actionable pledges about future actions
    - Exclude political commentary, statements of fact, or general values
    - Source field must contain exact quotes from the document text
    - Each promise should have clear supporting evidence in the source quotes
    - Group similar promises under appropriate categories
    - Reply in the language the document is written in

    **Document:**
    
    `;

      const documentIds =
        (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [];
      const documents = [];
      const limit = 50;
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const pageResult = await payload.find({
          collection: "documents",
          limit,
          page,
          where: documentIds.length
            ? {
                id: {
                  in: documentIds,
                },
              }
            : undefined,
        });

        documents.push(...pageResult.docs.filter((doc) => !doc.fullyProcessed));
        hasNextPage = pageResult.hasNextPage;
        page += 1;
      }

      if (documents.length === 0) {
        logger.info("extractPromises:: No documents to extract promises from");
        return { output: { docs: [] } };
      }

      logger.info(`extractPromises:: Extracting ${documents.length} documents`);

      const processedDocs = [];

      for (const document of documents) {
        const { extractedText } = document;

        const { docs: existingExtractions } = await payload.find({
          collection: "ai-extractions",
          where: {
            document: {
              equals: document.id,
            },
          },
          limit: 1,
        });

        const existingExtraction = existingExtractions[0];

        if (existingExtraction) {
          logger.info({
            message:
              "extractPromises:: Skipping document with existing AI extraction",
            documentId: document.id,
            extractionId: existingExtraction.id,
          });

          if (!document.fullyProcessed) {
            await payload.update({
              collection: "documents",
              id: document.id,
              data: {
                fullyProcessed: true,
              },
            });
          }

          continue;
        }

        const plainTextSegments =
          extractedText?.reduce<string[]>((acc, textEntry) => {
            if (!textEntry?.text) {
              return acc;
            }

            acc.push(convertLexicalToPlaintext({ data: textEntry.text }));
            return acc;
          }, []) ?? [];

        const plainText = plainTextSegments.join("\n");

        if (!plainText || plainText?.length === 0) {
          logger.error("extractPromises:: No text to process");
          continue;
        }

        try {
          const res = await generateObject({
            model,
            system: systemPrompt,
            prompt: `${prompt} ${plainText}`,
            schema: z.object({
              title: z
                .string()
                .describe(
                  "Inferred title from the document content, or the provided document title as fallback",
                ),
              promises: z.array(
                z.object({
                  category: z
                    .string()
                    .describe("The thematic category of the promise"),
                  summary: z
                    .string()
                    .describe("A concise summary of the promise"),
                  source: z
                    .array(z.string())
                    .describe(
                      "Array of direct quotations from the text that support this promise",
                    ),
                }),
              ),
            }),
            maxRetries: 5,
          });

          const { object } = res;

          logger.info({
            message: "extractPromises:: AI response received",
            documentId: document.id,
            promises: object.promises.length,
          });

          if (object.promises.length > 0) {
            await payload.create({
              collection: "ai-extractions",
              data: {
                title: object.title,
                document: document,
                extractions: object.promises.map((promise) => ({
                  category: promise.category,
                  summary: promise.summary,
                  source: promise.source
                    .map((quote, index) => `${index + 1}: ${quote}\n`)
                    .join("\n"),
                  uniqueId: randomUUID(),
                })),
              },
            });

            await payload.update({
              collection: "documents",
              id: document.id,
              data: {
                fullyProcessed: true,
              },
            });
          }

          processedDocs.push({
            id: document.id,
            title: object.title,
            promises: object.promises,
          });
        } catch (error) {
          logger.error({
            message: "extractPromises:: Error generating AI Response::",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info({
        message: `extractPromises:: Extracted ${processedDocs.length} documents`,
      });

      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message: "Error:",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
