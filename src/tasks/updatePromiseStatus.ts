import { TaskConfig } from "payload";
import {
  AiExtraction as AiExtractionDoc,
  PromiseStatus,
} from "@/payload-types";
import { fetchProjectMediaStatuses } from "@/lib/meedan";
import { getTaskLogger, withTaskTracing, type TaskInput } from "./utils";

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
  handler: withTaskTracing("updatePromiseStatus", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "updatePromiseStatus", input);

    logger.info("updatePromiseStatus:: Starting Meedan status sync");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      throw new Error("Meedan API key or team ID not configured in settings");
    }

    try {
      const remoteStatusesList = await fetchProjectMediaStatuses({
        apiKey: meedanAPIKey,
        teamId,
      });

      const remoteStatuses = new Map(
        remoteStatusesList.map(({ checkMediaId, status }) => [
          checkMediaId,
          status,
        ]),
      );

      if (remoteStatuses.size === 0) {
        logger.info(
          "updatePromiseStatus:: No remote statuses returned, nothing to update",
        );
        return {
          output: { updated: 0 },
        };
      }

      const { docs: statusDocs } = await payload.find({
        collection: "promise-status",
        limit: 0,
        depth: 0,
      });

      const statusIdByMeedan = new Map<string, string>();
      for (const statusDoc of statusDocs) {
        statusIdByMeedan.set(statusDoc.meedanId, statusDoc.id);
      }

      const { docs: aiExtractions } = await payload.find({
        collection: "ai-extractions",
        limit: 0,
        depth: 0,
      });

      let updatedPromises = 0;
      let failedExtractions = 0;

      for (const extractionDoc of aiExtractions as AiExtractionDoc[]) {
        try {
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
              logger.warn({
                message:
                  "updatePromiseStatus:: No local status mapping for Meedan status",
                extractionDocId: extractionDoc.id,
                extractionDocTitle: extractionDoc.title,
                extractionUniqueId: extraction.uniqueId,
                checkMediaId,
                remoteStatus,
              });
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
            logger.info({
              message: "updatePromiseStatus:: Updated AI extraction statuses",
              extractionDocId: extractionDoc.id,
              extractionDocTitle: extractionDoc.title,
              extractionCount: extractions.length,
            });
          }
        } catch (extractionDocError) {
          failedExtractions += 1;
          logger.error({
            message: "updatePromiseStatus:: Failed processing AI extraction doc",
            extractionDocId: extractionDoc.id,
            extractionDocTitle: extractionDoc.title,
            extractionCount: extractionDoc.extractions?.length ?? 0,
            error:
              extractionDocError instanceof Error
                ? extractionDocError.message
                : String(extractionDocError),
          });
        }
      }

      logger.info({
        message: "updatePromiseStatus:: Completed syncing statuses",
        updated: updatedPromises,
        failed: failedExtractions,
        total: aiExtractions.length,
      });

      return {
        output: {
          updated: updatedPromises,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error ?? "");
      logger.error({
        message: "updatePromiseStatus:: Failed to sync statuses",
        requestedDocumentIds:
          (input as TaskInput | undefined)?.documentIds?.filter(Boolean) ?? [],
        error: errorMessage,
      });
      logger.warn({
        message:
          "updatePromiseStatus:: Continuing workflow despite task-level failure",
        recoverable: true,
      });

      return {
        output: {
          updated: 0,
          recoverableError: true,
          error: errorMessage,
        },
      };
    }
  }),
};
