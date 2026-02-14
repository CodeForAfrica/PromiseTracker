import { TaskConfig } from "payload";
import { getUnprocessedDocuments } from "@/lib/airtable";
import { LANGUAGE_MAP } from "@/utils/locales";
import { getTaskLogger, withTaskTracing } from "./utils";

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

      const validUnprocessedDocuments = unProcessedDocuments.filter(
        (doc) => doc.name && (doc.uRL || doc.documents.length > 0),
      );

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
          const politicalEntityAirtableID = doc.politicalEntity[0];

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

          return await payload.create({
            collection: "documents",
            data: {
              title: doc.name || doc.id,
              politicalEntity: entity,
              language: LANGUAGE_MAP[doc?.language || ""] || "",
              type: doc.type?.toLowerCase() as "promise" | "evidence",
              airtableID: doc.id,
              url: doc.uRL,
              docURLs: doc.documents.map((t) => ({
                url: t,
              })),
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

      creationResults.forEach((result, index) => {
        const doc = docsToCreate[index];

        if (result.status === "fulfilled") {
          createdDocsCount += 1;
          return;
        }

        failedDocs.push({
          docID: doc.id,
          docName: doc.name,
          politicalEntityAirtableID: doc.politicalEntity[0] ?? null,
          reason: result.reason,
        });
      });

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
