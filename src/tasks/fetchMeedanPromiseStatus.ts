import { TaskConfig } from "payload";
import { fetchVerificationStatuses } from "@/lib/meedan";

export const FetchPromiseStatuses: TaskConfig<"fetchPromiseStatuses"> = {
  slug: "fetchPromiseStatuses",
  label: "Fetch Promise Statuses",
  handler: async ({ req }) => {
    const { payload } = req;
    const { logger } = payload;

    logger.info("fetchPromiseStatuses:: Starting fetch of Meedan statuses");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey) {
      throw new Error("Meedan API key not configured in settings");
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
          await payload.create({
            collection: "promise-status",
            data: {
              meedanId: status.id,
              label: status.label,
              description: status.description,
              colors: status.color ? { color: status.color } : {},
            },
          });
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
  },
};
