import { TaskConfig, type Where } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

const DEFAULT_RETENTION_HOURS = 24;

const getRetentionMs = () => {
  const raw = Number(process.env.PAYLOAD_JOBS_FAILED_RETENTION_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_HOURS;
  return hours * 60 * 60 * 1000;
};

export const CleanupFailedJobs: TaskConfig<"cleanupFailedJobs"> = {
  slug: "cleanupFailedJobs",
  label: "Cleanup Failed Jobs",
  retries: 1,
  schedule: [
    {
      cron: "0 * * * *",
      queue: process.env.PAYLOAD_JOBS_CLEANUP_QUEUE || "cleanup",
    },
  ],
  handler: withTaskTracing("cleanupFailedJobs", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "cleanupFailedJobs", input);

    const retentionMs = getRetentionMs();
    const cutoffDate = new Date(Date.now() - retentionMs);

    const where: Where = {
      and: [
        { hasError: { equals: true } },
        { completedAt: { less_than: cutoffDate.toISOString() } },
      ],
    };

    const { totalDocs } = await payload.count({
      collection: "payload-jobs",
      where,
    });

    if (!totalDocs) {
      logger.info({
        msg: "cleanupFailedJobs:: No failed jobs to delete",
        retentionHours: retentionMs / (60 * 60 * 1000),
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
      retentionHours: retentionMs / (60 * 60 * 1000),
      deleted: totalDocs,
    });

    return { output: { deleted: totalDocs } };
  }),
};
