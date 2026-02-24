import { randomUUID } from "node:crypto";
import { convertLexicalToPlaintext } from "@payloadcms/richtext-lexical/plaintext";
import { APICallError, NoObjectGeneratedError, Output, generateText, hasToolCall, stepCountIs, tool } from "ai";
import { TaskConfig } from "payload";
import { z } from "zod";
import { updateDocumentStatus } from "@/lib/airtable";
import {
  resolveConfiguredLanguageModel,
  type AISettingsInput,
} from "@/lib/ai/providerRegistry";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

type TaskLogger = ReturnType<typeof getTaskLogger>;

const MAX_CHUNK_CHARS = 14_000;
const CHUNK_OVERLAP_CHARS = 450;
const MAX_NORMALIZATION_CANDIDATES = 220;
const MAX_TOOL_STEPS = 40;

const passOnePromiseSchema = z.object({
  category: z.string().min(1).describe("Thematic category for the promise"),
  summary: z
    .string()
    .min(1)
    .describe("Single, atomic campaign promise in one sentence"),
  sourceQuotes: z
    .array(
      z
        .string()
        .min(1)
        .describe("Exact quote copied from the chunk that supports the promise"),
    )
    .min(1),
});

type PromiseCandidate = z.infer<typeof passOnePromiseSchema>;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const normalizeForLookup = (value: string): string =>
  normalizeWhitespace(value).toLowerCase();

const normalizeSummaryKey = (value: string): string =>
  normalizeForLookup(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitTextIntoChunks = (text: string): string[] => {
  const source = text.trim();
  if (!source) {
    return [];
  }

  if (source.length <= MAX_CHUNK_CHARS) {
    return [source];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < source.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, source.length);

    if (end < source.length) {
      const preferredBreaks = [
        source.lastIndexOf("\n\n", end),
        source.lastIndexOf(". ", end),
        source.lastIndexOf("? ", end),
        source.lastIndexOf("! ", end),
        source.lastIndexOf("; ", end),
      ];
      const bestBreak = Math.max(...preferredBreaks);

      if (bestBreak > start + Math.floor(MAX_CHUNK_CHARS * 0.55)) {
        end = bestBreak + 1;
      }
    }

    const chunk = source.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= source.length) {
      break;
    }

    start = Math.max(0, end - CHUNK_OVERLAP_CHARS);
  }

  return chunks;
};

const dedupeQuotes = (quotes: string[]): string[] => {
  const seen = new Set<string>();
  const uniqueQuotes: string[] = [];

  for (const quote of quotes) {
    const cleaned = normalizeWhitespace(quote);
    if (!cleaned) {
      continue;
    }

    const key = normalizeForLookup(cleaned);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueQuotes.push(cleaned);
  }

  return uniqueQuotes;
};

const hasVerifiableQuote = (quote: string, normalizedPlainText: string) => {
  const normalizedQuote = normalizeForLookup(quote);
  if (normalizedQuote.length < 8) {
    return false;
  }

  return normalizedPlainText.includes(normalizedQuote);
};

const mergeByAtomicPromise = (
  promises: PromiseCandidate[],
  plainText: string,
): PromiseCandidate[] => {
  const normalizedPlainText = normalizeForLookup(plainText);
  const merged = new Map<string, PromiseCandidate>();

  for (const promise of promises) {
    const category = normalizeWhitespace(promise.category);
    const summary = normalizeWhitespace(promise.summary);
    if (!category || !summary) {
      continue;
    }

    const verifiableQuotes = dedupeQuotes(promise.sourceQuotes).filter((quote) =>
      hasVerifiableQuote(quote, normalizedPlainText),
    );

    if (verifiableQuotes.length === 0) {
      continue;
    }

    const key = `${normalizeSummaryKey(summary)}::${normalizeForLookup(category)}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        category,
        summary,
        sourceQuotes: verifiableQuotes,
      });
      continue;
    }

    existing.sourceQuotes = dedupeQuotes([
      ...existing.sourceQuotes,
      ...verifiableQuotes,
    ]);
  }

  return [...merged.values()];
};

const formatSourceForStorage = (quotes: string[]) =>
  quotes.map((quote, index) => `${index + 1}: ${quote}\n`).join("\n");

const shouldForceReextractRun = (
  forceReextract: boolean,
  documentIds: string[],
) => forceReextract && documentIds.length > 0;

const buildPassOneSystemPrompt = () => `
You extract campaign promises from one document chunk.

Rules:
- Return only specific future commitments that can be verified later.
- Never merge multiple commitments into one summary.
- If a sentence contains two commitments, split into two promises.
- Do not group promises by theme.
- sourceQuotes must be exact quotes copied from the chunk text.
- Keep the output in the same language as the chunk.
`;

const buildPassOnePrompt = (chunk: string, chunkIndex: number, chunkTotal: number) => `
Document chunk ${chunkIndex + 1} of ${chunkTotal}.

Extract all campaign promises in this chunk.
Each object must represent exactly one distinct promise.

Chunk text:
${chunk}
`;

const buildNormalizationSystemPrompt = () => `
You normalize extracted campaign promises into atomic promises.

You must use tools only:
1) Call recordPromise once per final promise.
2) Call finalizeExtraction exactly once when done.

Rules:
- One tool call = one atomic promise.
- Never combine distinct commitments under one summary.
- Keep repeated mentions of the same exact pledge as one promise with multiple quotes.
- Do not include non-promises, opinions, or vague values.
- sourceQuotes must remain exact snippets from the document text.
`;

const buildNormalizationPrompt = ({
  documentTitle,
  candidates,
}: {
  documentTitle: string;
  candidates: PromiseCandidate[];
}) => `
Normalize the candidate promises below.
Return only atomic promises.
If there are no valid promises, call finalizeExtraction with the best title and do not call recordPromise.

Candidate promises:
${JSON.stringify(candidates, null, 2)}

Document title fallback: ${documentTitle}
`;

const extractPromisesFromChunks = async ({
  model,
  chunks,
  logger,
  documentId,
  documentTitle,
  documentAirtableID,
}: {
  model: ReturnType<typeof resolveConfiguredLanguageModel>["model"];
  chunks: string[];
  logger: TaskLogger;
  documentId: string;
  documentTitle: string;
  documentAirtableID: string | null | undefined;
}) => {
  const candidates: PromiseCandidate[] = [];
  const output = Output.array({
    element: passOnePromiseSchema,
    name: "campaign_promises",
    description:
      "Atomic campaign promises with category, summary, and direct supporting quotes.",
  });

  for (const [index, chunk] of chunks.entries()) {
    try {
      const { output: chunkPromises } = await generateText({
        model,
        system: buildPassOneSystemPrompt(),
        prompt: buildPassOnePrompt(chunk, index, chunks.length),
        output,
        maxRetries: 4,
      });

      candidates.push(...chunkPromises);

      logger.info({
        message: "extractPromises:: Chunk extracted",
        documentId,
        documentTitle,
        documentAirtableID,
        chunkIndex: index,
        chunkCount: chunks.length,
        promises: chunkPromises.length,
      });
    } catch (error) {
      logger.warn({
        message: "extractPromises:: Failed extracting one chunk",
        documentId,
        documentTitle,
        documentAirtableID,
        chunkIndex: index,
        chunkCount: chunks.length,
        error: error instanceof Error ? error.message : String(error),
      });

      if (
        APICallError.isInstance(error) ||
        NoObjectGeneratedError.isInstance(error)
      ) {
        continue;
      }

      throw error;
    }
  }

  return candidates;
};

const normalizeCandidatesWithTools = async ({
  model,
  documentTitle,
  candidates,
}: {
  model: ReturnType<typeof resolveConfiguredLanguageModel>["model"];
  documentTitle: string;
  candidates: PromiseCandidate[];
}) => {
  const normalizedPromises: PromiseCandidate[] = [];
  let normalizedTitle = documentTitle;

  const recordPromise = tool({
    description:
      "Store exactly one atomic campaign promise with supporting direct quotes.",
    inputSchema: passOnePromiseSchema,
    execute: async (input) => {
      normalizedPromises.push({
        category: normalizeWhitespace(input.category),
        summary: normalizeWhitespace(input.summary),
        sourceQuotes: dedupeQuotes(input.sourceQuotes),
      });

      return {
        recordedCount: normalizedPromises.length,
      };
    },
  });

  const finalizeExtraction = tool({
    description: "Finalize extraction and provide the best title for this document.",
    inputSchema: z.object({
      title: z.string().min(1).describe("Best inferred title for this document"),
    }),
    execute: async ({ title }) => {
      normalizedTitle = normalizeWhitespace(title) || documentTitle;
      return {
        done: true,
      };
    },
  });

  await generateText({
    model,
    system: buildNormalizationSystemPrompt(),
    prompt: buildNormalizationPrompt({ documentTitle, candidates }),
    tools: {
      recordPromise,
      finalizeExtraction,
    },
    toolChoice: "required",
    stopWhen: [hasToolCall("finalizeExtraction"), stepCountIs(MAX_TOOL_STEPS)],
    maxRetries: 3,
  });

  return {
    title: normalizedTitle || documentTitle,
    promises: normalizedPromises,
  };
};

export const __extractPromisesTestUtils = {
  splitTextIntoChunks,
  mergeByAtomicPromise,
  formatSourceForStorage,
  shouldForceReextractRun,
};

export const ExtractPromises: TaskConfig<"extractPromises"> = {
  slug: "extractPromises",
  label: "Extract Promises",
  handler: withTaskTracing("extractPromises", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "extractPromises", input);
    logger.info("extractPromises:: Starting promise extraction");

    try {
      const settings = await payload.findGlobal({
        slug: "settings",
      });
      const {
        airtable: { airtableAPIKey },
      } = settings;

      const aiSettings = (settings.ai ?? {}) as AISettingsInput;
      const { model, modelId, providerId } =
        resolveConfiguredLanguageModel(aiSettings);

      logger.info({
        message: "extractPromises:: Resolved AI model",
        modelId,
        providerId,
      });

      const setDocumentStatus = async (
        airtableID: string | null | undefined,
        status: string,
      ) => {
        if (!airtableID || !airtableAPIKey) {
          return;
        }

        try {
          await updateDocumentStatus({
            airtableAPIKey,
            airtableID,
            status,
          });
        } catch (statusError) {
          logger.warn({
            message: "extractPromises:: Failed to update Airtable status",
            airtableID,
            status,
            error:
              statusError instanceof Error
                ? statusError.message
                : String(statusError),
          });
        }
      };

      const setDocumentFailedStatus = async (
        airtableID: string | null | undefined,
        reason: string,
      ) => {
        await setDocumentStatus(airtableID, `Failed: ${reason}`);
      };

      const taskInput = input as TaskInput | undefined;
      const documentIds = taskInput?.documentIds?.filter(Boolean) ?? [];
      const forceReextract = Boolean(taskInput?.forceReextract);
      const shouldForceReextract = shouldForceReextractRun(
        forceReextract,
        documentIds,
      );

      if (forceReextract && !documentIds.length) {
        logger.warn({
          message:
            "extractPromises:: forceReextract ignored because no explicit documentIds were provided",
        });
      }

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

        documents.push(
          ...pageResult.docs.filter((doc) =>
            shouldForceReextract ? true : !doc.fullyProcessed,
          ),
        );
        hasNextPage = pageResult.hasNextPage;
        page += 1;
      }

      if (documents.length === 0) {
        logger.info("extractPromises:: No documents to extract promises from");
        return { output: { docs: [] } };
      }

      logger.info(`extractPromises:: Extracting ${documents.length} documents`);

      const processedDocs = [];
      let failedDocs = 0;

      for (const document of documents) {
        try {
          await setDocumentStatus(document.airtableID, "Analysing by AI");
          const { extractedText } = document;

          const { docs: existingExtractions } = await payload.find({
            collection: "ai-extractions",
            where: {
              document: {
                equals: document.id,
              },
            },
            limit: 0,
          });

          if (existingExtractions.length > 0 && !shouldForceReextract) {
            logger.info({
              message:
                "extractPromises:: Skipping document with existing AI extraction",
              documentId: document.id,
              documentTitle: document.title,
              documentAirtableID: document.airtableID,
              extractionId: existingExtractions[0]?.id,
              extractionTitle: existingExtractions[0]?.title,
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

            await setDocumentStatus(document.airtableID, "Analysed by AI");
            continue;
          }

          if (existingExtractions.length > 0 && shouldForceReextract) {
            for (const extraction of existingExtractions) {
              await payload.delete({
                collection: "ai-extractions",
                id: extraction.id,
              });
            }

            logger.info({
              message:
                "extractPromises:: Deleted existing extractions before force re-extract",
              documentId: document.id,
              documentTitle: document.title,
              documentAirtableID: document.airtableID,
              deleted: existingExtractions.length,
            });
          }

          const plainTextSegments =
            extractedText?.reduce<string[]>((acc, textEntry) => {
              if (!textEntry?.text) {
                return acc;
              }

              acc.push(convertLexicalToPlaintext({ data: textEntry.text }));
              return acc;
            }, []) ?? [];

          const plainText = plainTextSegments.join("\n").trim();

          if (!plainText) {
            await setDocumentFailedStatus(
              document.airtableID,
              "No extracted text available for AI analysis",
            );
            logger.error({
              message: "extractPromises:: No text to process",
              documentId: document.id,
              documentTitle: document.title,
              documentAirtableID: document.airtableID,
              extractedTextSegments: plainTextSegments.length,
            });
            continue;
          }

          const chunks = splitTextIntoChunks(plainText);
          const extractedCandidates = await extractPromisesFromChunks({
            model,
            chunks,
            logger,
            documentId: document.id,
            documentTitle: document.title,
            documentAirtableID: document.airtableID,
          });

          const mergedCandidates = mergeByAtomicPromise(
            extractedCandidates,
            plainText,
          );

          const limitedCandidates =
            mergedCandidates.length > MAX_NORMALIZATION_CANDIDATES
              ? mergedCandidates.slice(0, MAX_NORMALIZATION_CANDIDATES)
              : mergedCandidates;

          if (mergedCandidates.length > MAX_NORMALIZATION_CANDIDATES) {
            logger.warn({
              message:
                "extractPromises:: Candidate list truncated before normalization",
              documentId: document.id,
              documentTitle: document.title,
              candidateCount: mergedCandidates.length,
              limit: MAX_NORMALIZATION_CANDIDATES,
            });
          }

          const normalized = await normalizeCandidatesWithTools({
            model,
            documentTitle: document.title,
            candidates: limitedCandidates,
          });

          const finalPromises = mergeByAtomicPromise(
            normalized.promises,
            plainText,
          );

          logger.info({
            message: "extractPromises:: AI normalization finished",
            documentId: document.id,
            documentTitle: document.title,
            documentAirtableID: document.airtableID,
            chunks: chunks.length,
            candidates: extractedCandidates.length,
            normalizedCandidates: mergedCandidates.length,
            finalPromises: finalPromises.length,
          });

          if (finalPromises.length > 0) {
            await payload.create({
              collection: "ai-extractions",
              data: {
                title: normalized.title || document.title,
                document: document.id,
                extractions: finalPromises.map((promise) => ({
                  category: promise.category,
                  summary: promise.summary,
                  source: formatSourceForStorage(promise.sourceQuotes),
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

            await setDocumentStatus(document.airtableID, "Analysed by AI");
          } else {
            await payload.update({
              collection: "documents",
              id: document.id,
              data: {
                fullyProcessed: true,
              },
            });
            await setDocumentStatus(
              document.airtableID,
              "Analysed by AI (No promises found)",
            );
          }

          processedDocs.push({
            id: document.id,
            title: normalized.title || document.title,
            promises: finalPromises,
          });
        } catch (documentError) {
          failedDocs += 1;
          const errorMessage =
            documentError instanceof Error
              ? documentError.message
              : String(documentError);
          await setDocumentFailedStatus(document.airtableID, errorMessage);
          logger.error({
            message: "extractPromises:: Failed processing document",
            documentId: document.id,
            documentTitle: document.title,
            documentAirtableID: document.airtableID,
            fullyProcessed: document.fullyProcessed,
            error: errorMessage,
          });
        }
      }

      logger.info({
        message: `extractPromises:: Extracted ${processedDocs.length} documents`,
        failed: failedDocs,
        total: documents.length,
      });

      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message: "extractPromises:: Error in promise extraction task",
        requestedDocumentIds:
          (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [],
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
