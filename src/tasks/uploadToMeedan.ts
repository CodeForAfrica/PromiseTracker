import { BasePayload, TaskConfig } from "payload";
import { createFactCheckClaim } from "@/lib/meedan";
import { markDocumentAsProcessed } from "@/lib/airtable";
import {
  AiExtraction,
  Document,
  Media,
  PoliticalEntity,
  Tenant,
} from "@/payload-types";

const getAIExtractionToUpload = (doc: AiExtraction) => {
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

const checkAndMarkDocumentComplete = async (
  doc: Document,
  payload: BasePayload
): Promise<void> => {
  if (doc.airtableID) {
    const {
      airtable: { airtableAPIKey },
    } = await payload.findGlobal({
      slug: "settings",
    });

    await markDocumentAsProcessed({
      airtableAPIKey,
      airtableID: doc.airtableID,
    });
  }
};

export const UploadToMeedan: TaskConfig<"uploadToMeedan"> = {
  slug: "uploadToMeedan",
  label: "Upload To Meedan",
  handler: async ({ req }) => {
    const { payload } = req;
    const { logger } = payload;

    logger.info("uploadToMeedan:: Starting uploadToMeedan task");

    try {
      const {
        meedan: { meedanAPIKey, teamId },
      } = await payload.findGlobal({
        slug: "settings",
      });

      if (!meedanAPIKey || !teamId) {
        throw new Error("Meedan API key or team ID not configured in settings");
      }

      const { docs: allPromises } = await payload.find({
        collection: "aiExtraction",
        limit: -1,
        depth: 4,
      });

      for (const doc of allPromises) {
        logger.info(
          `uploadToMeedan:: Processing promise: ${doc.id} - ${doc.title}`
        );

        const aiExtractions = getAIExtractionToUpload(doc);

        if (aiExtractions.length === 0) {
          logger.info(
            `uploadToMeedan:: Document ${doc.id} has no unprocessed AI extractions, skipping`
          );
          continue;
        }

        const document = doc.document as Document;
        const entity = document.politicalEntity as PoliticalEntity;
        const tenant = entity.tenant as Tenant;

        for (const extraction of aiExtractions) {
          logger.info(
            `uploadToMeedan:: Uploading extraction ${extraction.uniqueId} from document ${doc.id} to CheckMedia`
          );
          const tags = [
            entity.name,
            entity.region,
            tenant.country,
            tenant.name,
            document.type?.toUpperCase(),
            extraction.category,
          ].filter(Boolean) as string[];

          const quote = `${extraction.summary} \n\n${extraction.source}`.trim();

          const downloadedFile = document.files as Media[];

          const response = await createFactCheckClaim({
            apiKey: meedanAPIKey,
            teamId,
            quote: quote,
            tags,
            claimDescription: extraction.summary,
            factCheck: {
              title: extraction.summary,
              url: document.url || downloadedFile[0].url || "",
              language: document.language || "",
              publish_report: false,
            },
          });

          const checkMediaId =
            response.data.createProjectMedia.project_media.id;
          const checkMediaURL =
            response.data.createProjectMedia.project_media.full_url;

          logger.info(
            `uploadToMeedan:: Successfully uploaded extraction ${extraction.uniqueId} to CheckMedia`,
            {
              checkMediaId,
              checkMediaURL,
            }
          );

          const updatedAiExtraction = doc.extractions?.map((ext) => {
            if (ext.uniqueId === extraction.uniqueId) {
              return {
                ...ext,
                checkMediaId,
                checkMediaURL,
              };
            }
            return ext;
          });

          await payload.update({
            collection: "aiExtraction",
            id: doc.id,
            data: {
              extractions: updatedAiExtraction,
            },
          });

          logger.info(
            `uploadToMeedan:: Updated extraction ${extraction.uniqueId} in document ${doc.id} with CheckMedia data`
          );
        }

        await checkAndMarkDocumentComplete(document, payload);
      }

      return {
        output: {},
      };
    } catch (error) {
      logger.error("uploadToMeedan::  Uploading to Meedan failed:", { error });
      throw error;
    }
  },
};
