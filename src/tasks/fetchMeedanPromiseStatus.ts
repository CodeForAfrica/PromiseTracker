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
        "fetchPromiseStatuses:: Missing Meedan credentials, skipping sync"
      );
      return { output: { created: 0 } };
    }

    try {
      const statuses = await fetchVerificationStatuses({
        apiKey: meedanAPIKey,
        teamId,
      });

      let created = 0;
      for (const status of statuses) {
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
          logger.info(
            `fetchPromiseStatuses:: Created new status ${status.id} (${status.label})`
          );
        }
      }

      logger.info(
        `fetchPromiseStatuses:: Completed. Created ${created} new statuses.`
      );

      return {
        output: { created },
      };
    } catch (error) {
      logger.error({
        message: "fetchPromiseStatuses:: Failed to fetch/save statuses",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }),
};
