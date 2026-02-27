import { TaskConfig } from "payload";
import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { updateDocumentStatus } from "@/lib/airtable";
import {
  addMediaSourceLookup,
  getMediaIdFromLookup,
  normalizeMediaSourceUrl,
} from "@/lib/mediaUrl";
import { downloadFile } from "@/utils/files";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

type DocURL = {
  url?: string | null;
} | null;

type DownloadableDocument = {
  id: string;
  airtableID?: string | null;
  title?: string | null;
  url?: string | null;
  docURLs?: DocURL[] | null;
};

type DownloadableDocumentWithFiles = DownloadableDocument & {
  files?: unknown;
  extractedText?: unknown;
};

type DuplicateSource = {
  documentId: string;
  airtableID?: string | null;
  title?: string | null;
  fileIds: string[];
  extractedText?: unknown;
};

type ExistingMediaForLookup = {
  id: string;
  url?: string | null;
  externalUrl?: string | null;
};

const getDocumentSourceUrls = (
  doc: Pick<DownloadableDocument, "url" | "docURLs">,
): string[] => {
  const preferredUrls =
    doc.docURLs
      ?.map((entry) => normalizeMediaSourceUrl(entry?.url))
      .filter((candidate): candidate is string => Boolean(candidate)) ?? [];

  if (preferredUrls.length > 0) {
    return Array.from(new Set(preferredUrls));
  }

  const fallbackUrl = normalizeMediaSourceUrl(doc.url);
  return fallbackUrl ? [fallbackUrl] : [];
};

const createSourceSignature = (urls: string[]): string | null => {
  const normalized = Array.from(
    new Set(urls.map((value) => normalizeMediaSourceUrl(value))),
  ).filter(Boolean);

  if (normalized.length === 0) {
    return null;
  }

  const serialized = normalized.sort().join("\n");
  return createHash("sha256").update(serialized).digest("hex");
};

const extractFileIds = (files: unknown): string[] => {
  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .map((entry) => {
      if (typeof entry === "string") {
        return entry;
      }

      if (
        entry &&
        typeof entry === "object" &&
        "id" in entry &&
        typeof entry.id === "string"
      ) {
        return entry.id;
      }

      return "";
    })
    .filter(Boolean);
};

const hasExtractedText = (value: unknown): value is unknown[] =>
  Array.isArray(value) && value.length > 0;

export const DownloadDocuments: TaskConfig<"downloadDocuments"> = {
  retries: 2,
  slug: "downloadDocuments",
  label: "Download Documents",
  handler: withTaskTracing("downloadDocuments", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "downloadDocuments", input);
    logger.info("downloadDocuments:: Starting Downloading of Documents");

    try {
      const {
        airtable: { airtableAPIKey },
      } = await payload.findGlobal({
        slug: "settings",
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
            message: "downloadDocuments:: Failed to update Airtable status",
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

      const dedupeSourcesBySignature = new Map<string, DuplicateSource>();
      const sourceUrlsInScope = Array.from(
        new Set(
          documents.flatMap((doc) =>
            getDocumentSourceUrls(doc as DownloadableDocument),
          ),
        ),
      );

      if (sourceUrlsInScope.length > 0) {
        const { docs: existingDocsWithFiles } = await payload.find({
          collection: "documents",
          where: {
            and: [
              {
                files: {
                  exists: true,
                },
              },
              {
                or: [
                  {
                    url: {
                      in: sourceUrlsInScope,
                    },
                  },
                  {
                    "docURLs.url": {
                      in: sourceUrlsInScope,
                    },
                  },
                ],
              },
            ],
          },
          select: {
            airtableID: true,
            title: true,
            url: true,
            docURLs: true,
            files: true,
            extractedText: true,
          },
          depth: 0,
          limit: 0,
        });

        for (const existingDoc of existingDocsWithFiles as DownloadableDocumentWithFiles[]) {
          const sourceUrls = getDocumentSourceUrls(existingDoc);
          const sourceSignature = createSourceSignature(sourceUrls);

          if (!sourceSignature || dedupeSourcesBySignature.has(sourceSignature)) {
            continue;
          }

          const fileIds = extractFileIds(existingDoc.files);
          if (fileIds.length === 0) {
            continue;
          }

          dedupeSourcesBySignature.set(sourceSignature, {
            documentId: existingDoc.id,
            airtableID: existingDoc.airtableID,
            title: existingDoc.title,
            fileIds,
            extractedText: existingDoc.extractedText,
          });
        }
      }

      const mediaSourceLookup = new Map<string, string>();

      if (sourceUrlsInScope.length > 0) {
        const { docs: existingMediaDocs } = await payload.find({
          collection: "media",
          where: {
            or: [
              {
                url: {
                  in: sourceUrlsInScope,
                },
              },
              {
                externalUrl: {
                  in: sourceUrlsInScope,
                },
              },
            ],
          },
          select: {
            url: true,
            externalUrl: true,
          },
          depth: 0,
          limit: 0,
        });

        for (const mediaDoc of existingMediaDocs as ExistingMediaForLookup[]) {
          addMediaSourceLookup(
            mediaSourceLookup,
            mediaDoc.id,
            mediaDoc.url,
            mediaDoc.externalUrl,
          );
        }
      }

      logger.info(
        `downloadDocuments:: Downloading ${documents.length}. Documents:\n ${documents.map((t) => `${t.title}\n`)}`,
      );

      const processedDocs = [];
      let dedupedDocs = 0;
      let reusedFromMediaCount = 0;

      for (const doc of documents) {
        try {
          logger.info({
            message: "downloadDocuments:: Processing document",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
          });
          await setDocumentStatus(doc.airtableID, "Downloading");
          const urlsToFetch = getDocumentSourceUrls(doc as DownloadableDocument);
          const sourceSignature = createSourceSignature(urlsToFetch);

          if (urlsToFetch.length === 0) {
            await setDocumentFailedStatus(
              doc.airtableID,
              "No source URL or attachment available for download",
            );
            logger.warn({
              message: "downloadDocuments:: Document has no URL",
              id: doc.id,
              airtableID: doc.airtableID,
              title: doc.title,
            });
            continue;
          }

          const duplicateSource =
            sourceSignature && dedupeSourcesBySignature.has(sourceSignature)
              ? dedupeSourcesBySignature.get(sourceSignature)
              : null;

          if (duplicateSource && duplicateSource.documentId !== doc.id) {
            const updateData: Record<string, unknown> = {
              files: duplicateSource.fileIds,
            };

            if (hasExtractedText(duplicateSource.extractedText)) {
              updateData.extractedText = duplicateSource.extractedText;
            }

            await payload.update({
              collection: "documents",
              id: doc.id,
              data: updateData,
            });

            dedupedDocs += 1;
            await setDocumentStatus(doc.airtableID, "Duplicate");
            logger.info({
              message:
                "downloadDocuments:: Reused files from duplicate document source",
              id: doc.id,
              airtableID: doc.airtableID,
              title: doc.title,
              dedupedFromDocumentId: duplicateSource.documentId,
              dedupedFromAirtableID: duplicateSource.airtableID,
              dedupedFromTitle: duplicateSource.title,
            });
            processedDocs.push({ id: doc.id });
            continue;
          }

          const reusableFileIds = Array.from(
            new Set(
              urlsToFetch
                .map((sourceUrl) =>
                  getMediaIdFromLookup(mediaSourceLookup, sourceUrl),
                )
                .filter((value): value is string => Boolean(value)),
            ),
          );

          const missingUrls = urlsToFetch.filter(
            (sourceUrl) => !getMediaIdFromLookup(mediaSourceLookup, sourceUrl),
          );

          if (missingUrls.length === 0 && reusableFileIds.length > 0) {
            await payload.update({
              collection: "documents",
              id: doc.id,
              data: {
                files: reusableFileIds,
              },
            });

            reusedFromMediaCount += 1;
            await setDocumentStatus(doc.airtableID, "Downloaded");
            logger.info({
              message:
                "downloadDocuments:: Reused existing media records for all source URLs",
              id: doc.id,
              airtableID: doc.airtableID,
              title: doc.title,
              reusedFileCount: reusableFileIds.length,
            });
            processedDocs.push({ id: doc.id });
            continue;
          }

          const fileIds = [...reusableFileIds];

          for (const fileUrl of missingUrls) {
            let filePath: string | null = null;

            try {
              filePath = await downloadFile(fileUrl);
              const mediaUpload = await payload.create({
                collection: "media",
                data: {
                  alt: doc.title,
                  externalUrl: fileUrl,
                },
                filePath,
              });

              const mediaId = (mediaUpload as any)?.id ?? mediaUpload;
              if (mediaId) {
                fileIds.push(mediaId);
                addMediaSourceLookup(
                  mediaSourceLookup,
                  mediaId,
                  fileUrl,
                  (mediaUpload as any)?.url,
                  (mediaUpload as any)?.externalUrl,
                );
              }
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
            } finally {
              if (filePath) {
                try {
                  await unlink(filePath);
                } catch (cleanupError) {
                  logger.warn({
                    message:
                      "downloadDocuments:: Failed to cleanup downloaded temp file",
                    id: doc.id,
                    airtableID: doc.airtableID,
                    title: doc.title,
                    url: fileUrl,
                    filePath,
                    error:
                      cleanupError instanceof Error
                        ? cleanupError.message
                        : String(cleanupError),
                  });
                }
              }
            }
          }

          const uniqueFileIds = Array.from(new Set(fileIds));

          if (uniqueFileIds.length === 0) {
            await setDocumentFailedStatus(
              doc.airtableID,
              "Failed to download from all document source URLs",
            );
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
              files: uniqueFileIds,
            },
          });

          if (
            sourceSignature &&
            uniqueFileIds.length > 0 &&
            !dedupeSourcesBySignature.has(sourceSignature)
          ) {
            dedupeSourcesBySignature.set(sourceSignature, {
              documentId: doc.id,
              airtableID: doc.airtableID,
              title: doc.title,
              fileIds: uniqueFileIds,
            });
          }

          logger.info({
            message: "downloadDocuments:: Document processed successfully",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
          });
          await setDocumentStatus(doc.airtableID, "Downloaded");
          processedDocs.push({ id: doc.id });
        } catch (docError) {
          const errorMessage =
            docError instanceof Error ? docError.message : String(docError);
          await setDocumentFailedStatus(doc.airtableID, errorMessage);
          logger.error({
            message: "downloadDocuments:: Error processing document",
            id: doc.id,
            airtableID: doc.airtableID,
            title: doc.title,
            url: doc.url,
            docURLs: doc.docURLs?.map((entry) => entry.url),
            error: errorMessage,
          });
        }
      }

      logger.info(
        `downloadDocuments:: Successfully processed ${processedDocs.length} of ${documents.length} documents (${dedupedDocs} reused from duplicates, ${reusedFromMediaCount} reused from media URL lookup)`,
      );
      return {
        output: {},
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error ?? "");
      logger.error({
        message: "downloadDocuments:: Error in document download task",
        requestedDocumentIds:
          (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [],
        error: errorMessage,
      });
      throw error;
    }
  }),
};
