import { TaskConfig, type Where } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

const DEFAULT_RETENTION_DAYS = 7;

const getRetentionDays = () => {
  const raw = Number(process.env.PAYLOAD_JOBS_FAILED_RETENTION_DAYS);
  if (Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  return DEFAULT_RETENTION_DAYS;
};

const getCleanupQueue = () => process.env.PAYLOAD_JOBS_QUEUE || "everyMinute";

export const CleanupFailedJobs: TaskConfig<"cleanupFailedJobs"> = {
  slug: "cleanupFailedJobs",
  label: "Cleanup Failed Jobs",
  retries: 1,
  schedule: [
    {
      cron: "0 0 * * *",
      queue: getCleanupQueue(),
    },
  ],
  handler: withTaskTracing("cleanupFailedJobs", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "cleanupFailedJobs", input);

    const retentionDays = getRetentionDays();
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000,
    );

    const where: Where = {
      and: [
        {
          hasError: {
            equals: true,
          },
        },
        {
          completedAt: {
            less_than: cutoffDate.toISOString(),
          },
        },
      ],
    };

    const { totalDocs } = await payload.count({
      collection: "payload-jobs",
      where,
    });

    if (!totalDocs) {
      logger.info({
        msg: "cleanupFailedJobs:: No failed jobs to delete",
        retentionDays,
      });
      return { output: { deleted: 0 } };
    }

    await payload.delete({
      collection: "payload-jobs",
      where,
      overrideAccess: true,
    });

    logger.info({
      msg: "cleanupFailedJobs:: Deleted failed jobs",
      retentionDays,
      deleted: totalDocs,
    });

    return { output: { deleted: totalDocs } };
  }),
};
