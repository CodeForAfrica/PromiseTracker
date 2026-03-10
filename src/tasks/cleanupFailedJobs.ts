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
    const now = new Date().toISOString();

    // Failed jobs that have been around longer than the retention window
    const failedWhere: Where = {
      and: [
        { hasError: { equals: true } },
        { completedAt: { less_than: cutoffDate.toISOString() } },
      ],
    };

    // Orphaned pending jobs: never attempted, not scheduled for the future, older
    // than the retention window. These accumulate when jobs are queued into a queue
    // that has no worker (e.g. the "default" queue).
    const orphanedWhere: Where = {
      and: [
        { processing: { equals: false } },
        { hasError: { equals: false } },
        { totalTried: { equals: 0 } },
        { createdAt: { less_than: cutoffDate.toISOString() } },
        {
          or: [
            { waitUntil: { exists: false } },
            { waitUntil: { less_than: now } },
          ],
        },
      ],
    };

    const [{ totalDocs: failedCount }, { totalDocs: orphanedCount }] =
      await Promise.all([
        payload.count({ collection: "payload-jobs", where: failedWhere }),
        payload.count({ collection: "payload-jobs", where: orphanedWhere }),
      ]);

    const retentionHours = retentionMs / (60 * 60 * 1000);

    if (!failedCount && !orphanedCount) {
      logger.info({
        msg: "cleanupFailedJobs:: No jobs to delete",
        retentionHours,
      });
      return { output: { deletedFailed: 0, deletedOrphaned: 0 } };
    }

    await Promise.all([
      failedCount &&
        payload.delete({
          collection: "payload-jobs",
          where: failedWhere,
          overrideAccess: true,
        }),
      orphanedCount &&
        payload.delete({
          collection: "payload-jobs",
          where: orphanedWhere,
          overrideAccess: true,
        }),
    ]);

    logger.info({
      msg: "cleanupFailedJobs:: Deleted jobs",
      retentionHours,
      deletedFailed: failedCount,
      deletedOrphaned: orphanedCount,
    });

    return {
      output: { deletedFailed: failedCount, deletedOrphaned: orphanedCount },
    };
  }),
};
