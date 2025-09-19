import { TaskConfig } from "payload";
import { AiExtraction as AiExtractionDoc, PromiseStatus } from "@/payload-types";
import { fetchProjectMediaStatuses } from "@/lib/meedan";

type ExtractionItem = NonNullable<
  NonNullable<AiExtractionDoc["extractions"]>[number]
>;

const getStatusId = (value: ExtractionItem["Status"]) => {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  return (value as PromiseStatus)?.id;
};

export const UpdatePromiseStatus: TaskConfig<"updatePromiseStatus"> = {
  slug: "updatePromiseStatus",
  label: "Update Promise Status",
  handler: async ({ req }) => {
    const { payload } = req;
    const { logger } = payload;

    logger.info("updatePromiseStatus:: Starting Meedan status sync");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      throw new Error("Meedan API key or team ID not configured in settings");
    }

    const remoteStatusesList = await fetchProjectMediaStatuses({
      apiKey: meedanAPIKey,
      teamId,
    });

    const remoteStatuses = new Map(
      remoteStatusesList.map(({ checkMediaId, status }) => [
        checkMediaId,
        status,
      ])
    );

    if (remoteStatuses.size === 0) {
      logger.info(
        "updatePromiseStatus:: No remote statuses returned, nothing to update"
      );
      return {
        output: { updated: 0 },
      };
    }

    const { docs: statusDocs } = await payload.find({
      collection: "promise-status",
      limit: -1,
      depth: 0,
    });

    const statusIdByMeedan = new Map<string, string>();
    for (const statusDoc of statusDocs) {
      statusIdByMeedan.set(statusDoc.meedanId, statusDoc.id);
    }

    const { docs: aiExtractions } = await payload.find({
      collection: "ai-extractions",
      limit: -1,
      depth: 0,
    });

    let updatedPromises = 0;

    for (const extractionDoc of aiExtractions as AiExtractionDoc[]) {
      const extractions = extractionDoc.extractions ?? [];
      if (extractions.length === 0) {
        continue;
      }

      let didChange = false;
      const updatedExtractions = extractions.map((extraction) => {
        const checkMediaId = extraction.checkMediaId?.trim();
        if (!checkMediaId) {
          return extraction;
        }

        const remoteStatus = remoteStatuses.get(checkMediaId);
        if (!remoteStatus) {
          return extraction;
        }

        const statusDocId = statusIdByMeedan.get(remoteStatus);
        if (!statusDocId) {
          logger.warn(
            `updatePromiseStatus:: No local status mapping for Meedan status ${remoteStatus}`
          );
          return extraction;
        }

        const currentStatusId = getStatusId(extraction.Status);
        if (currentStatusId === statusDocId) {
          return extraction;
        }

        didChange = true;
        return {
          ...extraction,
          Status: statusDocId,
        };
      });

      if (didChange) {
        await payload.update({
          collection: "ai-extractions",
          id: extractionDoc.id,
          data: {
            extractions: updatedExtractions,
          },
        });
        updatedPromises += 1;
        logger.info(
          `updatePromiseStatus:: Updated AI extraction ${extractionDoc.id} with latest statuses`
        );
      }
    }

    logger.info(
      `updatePromiseStatus:: Completed syncing statuses. Updated ${updatedPromises} AI extractions.`
    );

    return {
      output: {
        updated: updatedPromises,
      },
    };
  },
};
