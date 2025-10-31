import { BasePayload, TaskConfig } from "payload";
import { createFactCheckClaim } from "@/lib/meedan";
import { markDocumentAsProcessed } from "@/lib/airtable";
import {
  AiExtraction as AiExtractionDoc,
  Document,
  Media,
  PoliticalEntity,
  Tenant,
} from "@/payload-types";

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

      const { docs: allExtractions } = await payload.find({
        collection: "ai-extractions",
        limit: -1,
        depth: 4,
      });

      for (const doc of allExtractions) {
        logger.info(
          `uploadToMeedan:: Processing AI extraction: ${doc.id} - ${doc.title}`
        );

        const extractionsToUpload = getExtractionsToUpload(doc);

        if (extractionsToUpload.length === 0) {
          logger.info(
            `uploadToMeedan:: Document ${doc.id} has no unprocessed AI extractions, skipping`
          );
          continue;
        }

        const document = doc.document as Document;
        const entity = document.politicalEntity as PoliticalEntity;
        const tenant = entity.tenant as Tenant;

        for (const extraction of extractionsToUpload) {
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
            `${entity.periodFrom}-${entity.periodTo}`,
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
          const returnedStatus =
            response.data.createProjectMedia.project_media.status;

          logger.info({
            message: `uploadToMeedan:: Successfully uploaded extraction ${extraction.uniqueId} to CheckMedia`,
            checkMediaId,
            checkMediaURL,
          });

          let statusRelationId: string | undefined;
          if (returnedStatus) {
            try {
              const statusRes = await payload.find({
                collection: "promise-status",
                where: { meedanId: { equals: returnedStatus } },
                limit: 1,
              });
              statusRelationId = statusRes.docs?.[0]?.id as string | undefined;
            } catch (e) {
              logger.warn(
                `uploadToMeedan:: Could not resolve status ${returnedStatus} to a promise-status doc. Error :${e}`
              );
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
      logger.error({
        message: "uploadToMeedan::  Uploading to Meedan failed:",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};
