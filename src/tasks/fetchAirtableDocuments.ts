import { TaskConfig } from "payload";
import { getUnprocessedDocuments } from "@/lib/airtable";
import { LANGUAGE_MAP } from "@/utils/locales";

export const FetchAirtableDocuments: TaskConfig<"fetchAirtableDocuments"> = {
  retries: 2,
  slug: "fetchAirtableDocuments",
  label: "Fetch Airtable Documents",
  handler: async ({ req: { payload } }) => {
    const { logger } = payload;
    logger.info(
      "fetchAirtableDocuments:: Starting fetching documents from Airtable"
    );

    const {
      airtable: { airtableAPIKey, airtableBaseID },
    } = await payload.findGlobal({
      slug: "settings",
    });

    if (!airtableAPIKey || !airtableBaseID) {
      logger.error(
        "fetchAirtableDocuments:: Airtable API Key and Base ID not configured"
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
        `fetchAirtableDocuments:: Unprocessed Documents: ${unProcessedDocuments.length}`
      );

      const validUnprocessedDocuments = unProcessedDocuments.filter(
        (doc) => doc.name && (doc.uRL || doc.documents.length > 0)
      );

      const { docs: existingDocs } = await payload.find({
        collection: "documents",
        where: {
          airtableID: {
            in: validUnprocessedDocuments.map((doc) => doc.id),
          },
        },
      });

      const docsToCreate = validUnprocessedDocuments.filter(
        (doc) =>
          !existingDocs.find((existing) => existing.airtableID === doc.id)
      );

      if (docsToCreate.length === 0) {
        logger.info("fetchAirtableDocuments:: No new documents to create");
        return { output: {} };
      }

      const { docs: entities } = await payload.find({
        collection: "political-entities",
        limit: -1,
        depth: 2,
      });

      const createdDocs = await Promise.all(
        docsToCreate.map(async (doc) => {
          const entity = entities.find(
            (t) => t.airtableID === doc.politicalEntity[0]
          );
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
        })
      );
      logger.info(
        `fetchAirtableDocuments:: Created ${createdDocs.length} new documents`
      );
      return {
        output: {},
      };
    } catch (error) {
      logger.error({
        message:
          "fetchAirtableDocuments:: Error Fetching Document from AIrtable",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
