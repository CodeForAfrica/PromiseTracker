import { TaskConfig } from "payload";
import { fetchPublishedReports } from "@/lib/meedan";
import { syncMeedanReports } from "@/lib/syncMeedanReports";
import { getTaskLogger, withTaskTracing } from "./utils";

export const SyncMeedanPromises: TaskConfig<"syncMeedanPromises"> = {
  slug: "syncMeedanPromises",
  label: "Sync Meedan Promises",
  handler: withTaskTracing("syncMeedanPromises", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "syncMeedanPromises", input);

    logger.info("syncMeedanPromises:: Starting Meedan promise sync");

    const {
      meedan: { meedanAPIKey, teamId },
    } = await payload.findGlobal({ slug: "settings" });

    if (!meedanAPIKey || !teamId) {
      logger.warn(
        "syncMeedanPromises:: Missing Meedan credentials, skipping sync",
      );
      return { output: { created: 0, updated: 0, total: 0 } };
    }

    try {
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
        reportCount: reports.length,
        result,
      });

      return {
        output: result,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error ?? "");
      logger.error({
        message: "syncMeedanPromises:: Failed syncing published reports",
        teamId,
        error: errorMessage,
      });
      logger.warn({
        message:
          "syncMeedanPromises:: Continuing workflow despite task-level failure",
        recoverable: true,
      });
      return {
        output: {
          created: 0,
          updated: 0,
          total: 0,
          recoverableError: true,
          error: errorMessage,
        },
      };
    }
  }),
};
