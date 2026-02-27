import { TaskConfig } from "payload";
import { fetchVerificationStatuses } from "@/lib/meedan";
import { getTaskLogger, withTaskTracing } from "./utils";

export const FetchPromiseStatuses: TaskConfig<"fetchPromiseStatuses"> = {
  slug: "fetchPromiseStatuses",
  label: "Fetch Promise Statuses",
  handler: withTaskTracing("fetchPromiseStatuses", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "fetchPromiseStatuses", input);

    logger.info("fetchPromiseStatuses:: Starting fetch of Meedan statuses");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      logger.warn(
        "fetchPromiseStatuses:: Missing Meedan credentials, skipping sync",
      );
      return { output: { created: 0 } };
    }

    try {
      const statuses = await fetchVerificationStatuses({
        apiKey: meedanAPIKey,
        teamId,
      });

      let created = 0;
      let failed = 0;
      for (const status of statuses) {
        try {
          const existing = await payload.find({
            collection: "promise-status",
            where: { meedanId: { equals: status.id } },
            limit: 1,
          });

          if (existing.totalDocs === 0) {
            const createdStatus = await payload.create({
              collection: "promise-status",
              locale: "en",
              data: {
                meedanId: status.id,
                label: status.label,
                description: status.description,
                colors: status.color ? { color: status.color } : {},
              },
            });

            const frenchLocale = status.locales?.fr;
            if (frenchLocale) {
              await payload.update({
                collection: "promise-status",
                id: createdStatus.id,
                locale: "fr",
                data: {
                  label: frenchLocale.label || status.label,
                  description: frenchLocale.description || status.description,
                },
              });
            }

            created += 1;
            logger.info({
              message: "fetchPromiseStatuses:: Created new status",
              meedanStatusId: status.id,
              label: status.label,
              createdStatusId: createdStatus.id,
            });
          }
        } catch (statusError) {
          failed += 1;
          logger.error({
            message: "fetchPromiseStatuses:: Failed processing status",
            meedanStatusId: status.id,
            label: status.label,
            description: status.description,
            color: status.color,
            hasFrenchLocale: Boolean(status.locales?.fr),
            error:
              statusError instanceof Error
                ? statusError.message
                : String(statusError),
          });
        }
      }

      logger.info({
        message: "fetchPromiseStatuses:: Completed status sync",
        created,
        failed,
        total: statuses.length,
      });

      return {
        output: { created },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error ?? "");
      logger.error({
        message: "fetchPromiseStatuses:: Failed to fetch/save statuses",
        teamId,
        error: errorMessage,
      });
      logger.warn({
        message:
          "fetchPromiseStatuses:: Continuing workflow despite task-level failure",
        recoverable: true,
      });
      return {
        output: {
          created: 0,
          recoverableError: true,
          error: errorMessage,
        },
      };
    }
  }),
};
