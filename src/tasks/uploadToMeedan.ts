import { TaskConfig } from "payload";
import { createFactCheckClaim } from "@/lib/meedan";
import { markDocumentAsProcessed, updateDocumentStatus } from "@/lib/airtable";
import {
  AiExtraction as AiExtractionDoc,
  Document,
  Media,
  PoliticalEntity,
  Tenant,
} from "@/payload-types";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

const getExtractionsToUpload = (doc: AiExtractionDoc) => {
  return (
    doc.extractions
      ?.filter((extraction) => !extraction.checkMediaId)
      .map(({ category, summary, source, uniqueId }) => ({
        category,
        summary,
        source,
        uniqueId,
      })) || []
  );
};

const looksLikeHostname = (value: string): boolean =>
  /^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value);

const getAppBaseUrl = (): string | null => {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).toString();
  } catch {
    return null;
  }
};

const toAbsoluteHttpUrl = (
  candidate?: string | null,
  baseUrl?: string | null,
): string | null => {
  const value = candidate?.trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    // Continue to fallback parsers below.
  }

  if (value.startsWith("//")) {
    try {
      return new URL(`https:${value}`).toString();
    } catch {
      return null;
    }
  }

  if (looksLikeHostname(value)) {
    try {
      return new URL(`https://${value}`).toString();
    } catch {
      return null;
    }
  }

  if (baseUrl) {
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return null;
    }
  }

  return null;
};

const resolveCheckMediaSourceUrl = ({
  documentSourceUrl,
  downloadedFileUrl,
}: {
  documentSourceUrl?: string | null;
  downloadedFileUrl?: string | null;
}): { url: string; source: "docSourceUrl" | "downloadedFile" } => {
  const appBaseUrl = getAppBaseUrl();

  const normalizedDocumentSourceUrl = toAbsoluteHttpUrl(
    documentSourceUrl,
    appBaseUrl,
  );
  if (normalizedDocumentSourceUrl) {
    return { url: normalizedDocumentSourceUrl, source: "docSourceUrl" };
  }

  const normalizedDownloadedFileUrl = toAbsoluteHttpUrl(
    downloadedFileUrl,
    appBaseUrl,
  );
  if (normalizedDownloadedFileUrl) {
    return { url: normalizedDownloadedFileUrl, source: "downloadedFile" };
  }

  throw new Error(
    `No valid URL for CheckMedia upload. documentSourceUrl="${documentSourceUrl ?? ""}", downloadedFileUrl="${downloadedFileUrl ?? ""}", NEXT_PUBLIC_APP_URL="${process.env.NEXT_PUBLIC_APP_URL ?? ""}"`,
  );
};

const hasPendingExtractions = (doc: AiExtractionDoc): boolean =>
  (doc.extractions ?? []).some((extraction) => !extraction?.checkMediaId);

const hasUploadedExtractions = (doc: AiExtractionDoc): boolean =>
  (doc.extractions ?? []).some((extraction) => Boolean(extraction?.checkMediaId));

const checkAndMarkDocumentComplete = async (
  doc: Document,
  airtableAPIKey?: string | null,
): Promise<void> => {
  if (!doc.airtableID || !airtableAPIKey) {
    return;
  }

  await markDocumentAsProcessed({
    airtableAPIKey,
    airtableID: doc.airtableID,
    status: "Uploaded to Meedan",
  });
};

export const UploadToMeedan: TaskConfig<"uploadToMeedan"> = {
  slug: "uploadToMeedan",
  label: "Upload To Meedan",
  retries: 0,
  handler: withTaskTracing("uploadToMeedan", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "uploadToMeedan", input);

    logger.info("uploadToMeedan:: Starting uploadToMeedan task");

    try {
      const {
        meedan: { meedanAPIKey, teamId },
        airtable: { airtableAPIKey },
      } = await payload.findGlobal({
        slug: "settings",
      });

      if (!meedanAPIKey || !teamId) {
        throw new Error("Meedan API key or team ID not configured in settings");
      }

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
            message: "uploadToMeedan:: Failed to update Airtable status",
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

      const canMarkDocumentAsProcessed = async (
        documentId: string,
      ): Promise<boolean> => {
        const { docs: extractionDocs } = await payload.find({
          collection: "ai-extractions",
          where: {
            document: {
              equals: documentId,
            },
          },
          limit: 0,
          select: {
            extractions: true,
          },
        });

        if (extractionDocs.length === 0) {
          return false;
        }

        let hasAnyUploadedPromise = false;

        for (const extractionDoc of extractionDocs as AiExtractionDoc[]) {
          if (hasPendingExtractions(extractionDoc)) {
            return false;
          }

          if (hasUploadedExtractions(extractionDoc)) {
            hasAnyUploadedPromise = true;
          }
        }

        return hasAnyUploadedPromise;
      };

      const markDocumentAsProcessedWhenReady = async (
        document: Document,
      ): Promise<boolean> => {
        if (!document.id || !document.airtableID || !airtableAPIKey) {
          return false;
        }

        const canMark = await canMarkDocumentAsProcessed(String(document.id));
        if (!canMark) {
          return false;
        }

        await checkAndMarkDocumentComplete(document, airtableAPIKey);
        return true;
      };

      const documentIdFilter = new Set(
        ((input as TaskInput | undefined)?.documentIds || []).filter(Boolean),
      );
      const limit = 50;
      let page = 1;
      let hasNextPage = true;
      let uploadedExtractions = 0;
      let failedExtractions = 0;
      let processedExtractionDocs = 0;
      let failedExtractionDocs = 0;

      while (hasNextPage) {
        const { docs: allExtractions, hasNextPage: nextPage } =
          await payload.find({
            collection: "ai-extractions",
            limit,
            page,
            depth: 4,
          });

        for (const doc of allExtractions) {
          const document = doc.document as Document;
          const documentId = document?.id ? String(document.id) : undefined;

          if (
            documentIdFilter.size > 0 &&
            (!documentId || !documentIdFilter.has(documentId))
          ) {
            continue;
          }

          if (!document) {
            failedExtractionDocs += 1;
            logger.error({
              message: "uploadToMeedan:: AI extraction is missing document",
              extractionDocId: doc.id,
              extractionDocTitle: doc.title,
            });
            continue;
          }

          try {
            logger.info({
              message: "uploadToMeedan:: Processing AI extraction document",
              extractionDocId: doc.id,
              extractionDocTitle: doc.title,
              documentId,
              documentTitle: document?.title,
              documentAirtableID: document?.airtableID,
            });

            const extractionsToUpload = getExtractionsToUpload(doc);

            if (extractionsToUpload.length === 0) {
              const markedAsProcessed =
                await markDocumentAsProcessedWhenReady(document);

              logger.info({
                message:
                  "uploadToMeedan:: AI extraction has no unprocessed entries",
                extractionDocId: doc.id,
                extractionDocTitle: doc.title,
                documentId,
                documentTitle: document?.title,
                documentAirtableID: document?.airtableID,
                markedAsProcessed,
              });
              continue;
            }

            await setDocumentStatus(document.airtableID, "Uploading to Meedan");
            const entity = document.politicalEntity as
              | PoliticalEntity
              | string
              | null
              | undefined;
            if (!entity || typeof entity === "string") {
              failedExtractionDocs += 1;
              await setDocumentFailedStatus(
                document.airtableID,
                "Missing populated political entity for upload",
              );
              logger.error({
                message:
                  "uploadToMeedan:: Document has no populated political entity",
                extractionDocId: doc.id,
                extractionDocTitle: doc.title,
                documentId,
                documentTitle: document.title,
                documentAirtableID: document.airtableID,
                politicalEntity: entity,
              });
              continue;
            }

            const tenant = entity.tenant as Tenant | string | null | undefined;
            if (!tenant || typeof tenant === "string") {
              failedExtractionDocs += 1;
              await setDocumentFailedStatus(
                document.airtableID,
                "Political entity tenant missing for upload",
              );
              logger.error({
                message: "uploadToMeedan:: Political entity has no tenant",
                extractionDocId: doc.id,
                extractionDocTitle: doc.title,
                documentId,
                documentTitle: document.title,
                documentAirtableID: document.airtableID,
                politicalEntityId: entity.id,
                politicalEntityName: entity.name,
                politicalEntityAirtableID: entity.airtableID,
                tenant,
              });
              continue;
            }
            let docFailedExtractions = 0;
            let docUploadedExtractions = 0;

            for (const extraction of extractionsToUpload) {
              try {
                logger.info({
                  message: "uploadToMeedan:: Uploading extraction to CheckMedia",
                  extractionDocId: doc.id,
                  extractionDocTitle: doc.title,
                  extractionUniqueId: extraction.uniqueId,
                  extractionCategory: extraction.category,
                  documentId,
                  documentTitle: document?.title,
                  documentAirtableID: document?.airtableID,
                });
                const tags = [
                  entity.name,
                  entity.region,
                  tenant.country,
                  tenant.name,
                  document.type?.toUpperCase(),
                  extraction.category,
                  `${entity.periodFrom}-${entity.periodTo}`,
                ].filter(Boolean) as string[];

                const quote =
                  `${extraction.summary} \n\n${extraction.source}`.trim();

                const downloadedFile = document.files as Media[];
                const sourceUrlResolution = resolveCheckMediaSourceUrl({
                  documentSourceUrl: document.url,
                  downloadedFileUrl: downloadedFile?.[0]?.url,
                });

                const response = await createFactCheckClaim({
                  apiKey: meedanAPIKey,
                  teamId,
                  quote: quote,
                  tags,
                  claimDescription: extraction.summary,
                  factCheck: {
                    title: extraction.summary,
                    url: sourceUrlResolution.url,
                    language: document.language || "",
                    publish_report: false,
                  },
                });

                const checkMediaId =
                  response.data.createProjectMedia.project_media.id;
                const checkMediaURL =
                  response.data.createProjectMedia.project_media.full_url;
                const returnedStatus =
                  response.data.createProjectMedia.project_media.status;

                logger.info({
                  message: "uploadToMeedan:: Extraction upload succeeded",
                  extractionDocId: doc.id,
                  extractionUniqueId: extraction.uniqueId,
                  extractionCategory: extraction.category,
                  checkMediaId,
                  checkMediaURL,
                  returnedStatus,
                  sourceUrl: sourceUrlResolution.url,
                  sourceUrlSource: sourceUrlResolution.source,
                });

                let statusRelationId: string | undefined;
                if (returnedStatus) {
                  try {
                    const statusRes = await payload.find({
                      collection: "promise-status",
                      where: { meedanId: { equals: returnedStatus } },
                      limit: 1,
                    });
                    statusRelationId = statusRes.docs?.[0]?.id as
                      | string
                      | undefined;
                  } catch (statusResolveError) {
                    logger.warn({
                      message:
                        "uploadToMeedan:: Could not resolve returned status to promise-status",
                      extractionDocId: doc.id,
                      extractionUniqueId: extraction.uniqueId,
                      returnedStatus,
                      documentId,
                      documentTitle: document?.title,
                      documentAirtableID: document?.airtableID,
                      error:
                        statusResolveError instanceof Error
                          ? statusResolveError.message
                          : String(statusResolveError),
                    });
                  }
                }

                const updatedExtractions = doc.extractions?.map((ext) => {
                  if (ext.uniqueId === extraction.uniqueId) {
                    return {
                      ...ext,
                      checkMediaId,
                      checkMediaURL,
                      ...(statusRelationId ? { Status: statusRelationId } : {}),
                    };
                  }
                  return ext;
                });

                await payload.update({
                  collection: "ai-extractions",
                  id: doc.id,
                  data: {
                    extractions: updatedExtractions,
                  },
                });

                uploadedExtractions += 1;
                docUploadedExtractions += 1;
                logger.info({
                  message:
                    "uploadToMeedan:: Updated AI extraction with CheckMedia data",
                  extractionDocId: doc.id,
                  extractionUniqueId: extraction.uniqueId,
                  checkMediaId,
                  checkMediaURL,
                });
              } catch (extractionError) {
                failedExtractions += 1;
                docFailedExtractions += 1;
                logger.error({
                  message: "uploadToMeedan:: Failed uploading extraction",
                  extractionDocId: doc.id,
                  extractionDocTitle: doc.title,
                  extractionUniqueId: extraction.uniqueId,
                  extractionCategory: extraction.category,
                  extractionSummary: extraction.summary,
                  documentId,
                  documentTitle: document?.title,
                  documentAirtableID: document?.airtableID,
                  politicalEntityName: entity?.name,
                  politicalEntityAirtableID: entity?.airtableID,
                  tenantName: tenant?.name,
                  tenantCountry: tenant?.country,
                  error:
                    extractionError instanceof Error
                      ? extractionError.message
                      : String(extractionError),
                });
              }
            }

            if (docFailedExtractions > 0) {
              await setDocumentFailedStatus(
                document.airtableID,
                `${docFailedExtractions} extraction(s) failed during upload`,
              );
              logger.warn({
                message:
                  "uploadToMeedan:: Skipping Airtable processed mark because some extractions failed",
                extractionDocId: doc.id,
                extractionDocTitle: doc.title,
                documentId,
                documentTitle: document?.title,
                documentAirtableID: document?.airtableID,
                uploadedExtractions: docUploadedExtractions,
                failedExtractions: docFailedExtractions,
                totalExtractionsToUpload: extractionsToUpload.length,
              });
              continue;
            }

            try {
              const markedAsProcessed =
                await markDocumentAsProcessedWhenReady(document);

              if (!markedAsProcessed) {
                logger.info({
                  message:
                    "uploadToMeedan:: Skipping processed mark; pending uploads remain for this document",
                  extractionDocId: doc.id,
                  extractionDocTitle: doc.title,
                  documentId,
                  documentTitle: document?.title,
                  documentAirtableID: document?.airtableID,
                });
              }
            } catch (markCompleteError) {
              const markCompleteErrorMessage =
                markCompleteError instanceof Error
                  ? markCompleteError.message
                  : String(markCompleteError);
              await setDocumentFailedStatus(
                document.airtableID,
                `Failed marking document processed: ${markCompleteErrorMessage}`,
              );
              logger.error({
                message:
                  "uploadToMeedan:: Failed marking Airtable document as processed",
                extractionDocId: doc.id,
                extractionDocTitle: doc.title,
                documentId,
                documentTitle: document?.title,
                documentAirtableID: document?.airtableID,
                error: markCompleteErrorMessage,
              });
            }

            processedExtractionDocs += 1;
          } catch (docError) {
            failedExtractionDocs += 1;
            const errorMessage =
              docError instanceof Error ? docError.message : String(docError);
            await setDocumentFailedStatus(document?.airtableID, errorMessage);
            logger.error({
              message: "uploadToMeedan:: Failed processing extraction document",
              extractionDocId: doc.id,
              extractionDocTitle: doc.title,
              documentId,
              documentTitle: document?.title,
              documentAirtableID: document?.airtableID,
              error: errorMessage,
            });
          }
        }

        hasNextPage = nextPage;
        page += 1;
      }

      logger.info({
        message: "uploadToMeedan:: Upload task completed",
        processedExtractionDocs,
        failedExtractionDocs,
        uploadedExtractions,
        failedExtractions,
      });

      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message: "uploadToMeedan::  Uploading to Meedan failed:",
        requestedDocumentIds:
          (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [],
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
