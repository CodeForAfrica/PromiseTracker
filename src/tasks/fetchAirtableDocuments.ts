import { TaskConfig } from "payload";
import { getUnprocessedDocuments, updateDocumentStatus } from "@/lib/airtable";
import { LANGUAGE_MAP } from "@/utils/locales";
import { getTaskLogger, withTaskTracing } from "./utils";

type AirtableDocumentCandidate = {
  id: string;
  name?: string | null;
  documentName?: string | null;
  uRL?: string | null;
  docSourceUrl?: string | null;
  documents?: string[];
  language?: string | null;
  type?: string | null;
  politicalEntity?: string[];
};

const getAirtableDocumentName = (doc: AirtableDocumentCandidate): string =>
  (doc.documentName ?? doc.name ?? "").trim();

const getAirtableDocumentSourceUrl = (doc: AirtableDocumentCandidate): string =>
  (doc.docSourceUrl ?? doc.uRL ?? "").trim();

export const FetchAirtableDocuments: TaskConfig<"fetchAirtableDocuments"> = {
  retries: 2,
  slug: "fetchAirtableDocuments",
  label: "Fetch Airtable Documents",
  handler: withTaskTracing("fetchAirtableDocuments", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "fetchAirtableDocuments", input);
    logger.info(
      "fetchAirtableDocuments:: Starting fetching documents from Airtable",
    );

    const {
      airtable: { airtableAPIKey, airtableBaseID },
    } = await payload.findGlobal({
      slug: "settings",
    });

    if (!airtableAPIKey || !airtableBaseID) {
      logger.error(
        "fetchAirtableDocuments:: Airtable API Key and Base ID not configured",
      );
      throw new Error("Airtable API key or Base ID not found in settings");
    }

    const setDocumentStatus = async (
      airtableID: string | null | undefined,
      status: string,
    ) => {
      if (!airtableID) {
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
          message: "fetchAirtableDocuments:: Failed to update Airtable status",
          airtableDocumentID: airtableID,
          status,
          error:
            statusError instanceof Error
              ? statusError.message
              : String(statusError),
        });
      }
    };

    try {
      const unProcessedDocuments = await getUnprocessedDocuments({
        airtableAPIKey,
      });

      if (unProcessedDocuments.length === 0) {
        logger.info("fetchAirtableDocuments:: No unprocessed documents ");
        return { output: {} };
      }

      logger.info(
        `fetchAirtableDocuments:: Unprocessed Documents: ${unProcessedDocuments.length}`,
      );

      const airtableDocuments = unProcessedDocuments as AirtableDocumentCandidate[];
      const getDocumentValidationError = (
        doc: AirtableDocumentCandidate,
      ): string | null => {
        const title = getAirtableDocumentName(doc);
        const sourceUrl = getAirtableDocumentSourceUrl(doc);
        const hasAttachment = (doc.documents ?? []).length > 0;

        if (!title && !sourceUrl && !hasAttachment) {
          return "Missing required fields: document title and source URL/file";
        }

        if (!title) {
          return "Missing required field: document title";
        }

        if (!sourceUrl && !hasAttachment) {
          return "Missing required field: source URL or document attachment";
        }

        return null;
      };

      const validUnprocessedDocuments = airtableDocuments.filter(
        (doc) => !getDocumentValidationError(doc),
      );
      const invalidUnprocessedDocuments = airtableDocuments.filter((doc) =>
        Boolean(getDocumentValidationError(doc)),
      );

      for (const invalidDoc of invalidUnprocessedDocuments) {
        const validationError =
          getDocumentValidationError(invalidDoc) ??
          "Missing required fields for document processing";
        await setDocumentStatus(invalidDoc.id, `Failed: ${validationError}`);
      }

      const { docs: existingDocs } = await payload.find({
        collection: "documents",
        where: {
          airtableID: {
            in: validUnprocessedDocuments.map((doc) => doc.id),
          },
        },
        limit: 0,
      });

      const docsToCreate = validUnprocessedDocuments.filter(
        (doc) =>
          !existingDocs.find((existing) => existing.airtableID === doc.id),
      );

      if (docsToCreate.length === 0) {
        logger.info("fetchAirtableDocuments:: No new documents to create");
        return { output: {} };
      }

      const { docs: entities } = await payload.find({
        collection: "political-entities",
        limit: 0,
        depth: 2,
      });

      const creationResults = await Promise.allSettled(
        docsToCreate.map(async (doc) => {
          const politicalEntityAirtableID = doc.politicalEntity?.[0];

          if (!politicalEntityAirtableID) {
            throw new Error(
              "Missing political entity Airtable ID for document",
            );
          }

          const entity = entities.find(
            (t) => t.airtableID === politicalEntityAirtableID,
          );

          if (!entity) {
            throw new Error(
              `No political entity found for Airtable ID ${politicalEntityAirtableID}`,
            );
          }

          const title = getAirtableDocumentName(doc);
          const sourceUrl = getAirtableDocumentSourceUrl(doc);
          const docURLs = (doc.documents ?? [])
            .filter((value): value is string => Boolean(value))
            .map((url) => ({
              url,
            }));

          return await payload.create({
            collection: "documents",
            data: {
              title: title || doc.id,
              politicalEntity: entity,
              language: LANGUAGE_MAP[doc?.language || ""] || "",
              type: doc.type?.toLowerCase() as "promise" | "evidence",
              airtableID: doc.id,
              url: sourceUrl,
              docURLs,
            },
          });
        }),
      );

      const failedDocs: Array<{
        docID: string;
        docName: string | null;
        politicalEntityAirtableID: string | null;
        reason: unknown;
      }> = [];
      let createdDocsCount = 0;

      for (const [index, result] of creationResults.entries()) {
        const doc = docsToCreate[index];

        if (result.status === "fulfilled") {
          createdDocsCount += 1;
          await setDocumentStatus(doc.id, "Fetched");
          continue;
        }

        failedDocs.push({
          docID: doc.id,
          docName: getAirtableDocumentName(doc),
          politicalEntityAirtableID: doc.politicalEntity?.[0] ?? null,
          reason: result.reason,
        });

        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        await setDocumentStatus(doc.id, `Failed: ${errorMessage}`);
      }

      if (failedDocs.length > 0) {
        failedDocs.forEach((failedDoc) => {
          logger.error({
            message:
              "fetchAirtableDocuments:: Failed to create document from Airtable",
            airtableDocumentID: failedDoc.docID,
            documentName: failedDoc.docName,
            politicalEntityAirtableID: failedDoc.politicalEntityAirtableID,
            error:
              failedDoc.reason instanceof Error
                ? failedDoc.reason.message
                : String(failedDoc.reason),
          });
        });

        const failedDocIDs = failedDocs.map((failedDoc) => failedDoc.docID);
        throw new Error(
          `fetchAirtableDocuments:: Failed to create documents: ${failedDocIDs.join(", ")}`,
        );
      }

      logger.info(
        `fetchAirtableDocuments:: Created ${createdDocsCount} new documents`,
      );
      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message:
          "fetchAirtableDocuments:: Error fetching documents from Airtable",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
