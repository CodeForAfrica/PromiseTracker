import { TaskConfig } from "payload";
import { fetchPublishedReports } from "@/lib/meedan";
import { syncMeedanReports } from "@/lib/syncMeedanReports";

export const SyncMeedanPromises: TaskConfig<"syncMeedanPromises"> = {
  slug: "syncMeedanPromises",
  label: "Sync Meedan Promises",
  handler: async ({ req }) => {
    const { payload } = req;
    const { logger } = payload;

    logger.info("syncMeedanPromises:: Starting Meedan promise sync");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      logger.warn(
        "syncMeedanPromises:: Missing Meedan credentials, skipping sync"
      );
      return { output: { created: 0, updated: 0, total: 0 } };
    }

    const reports = await fetchPublishedReports({
      apiKey: meedanAPIKey,
      teamId,
    });

    if (reports.length === 0) {
      logger.info("syncMeedanPromises:: No published promises returned");
      return { output: { created: 0, updated: 0, total: 0 } };
    }

    const result = await syncMeedanReports({
      reports,
    });

    logger.info({
      message: "syncMeedanPromises:: Completed",
      result,
    });

    return {
      output: result,
    };
  },
};
