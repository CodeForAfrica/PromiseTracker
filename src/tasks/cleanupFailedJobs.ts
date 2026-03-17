import { TaskConfig, type Where } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

const DEFAULT_RETENTION_HOURS = 24;
// Shorter threshold for stuck/orphaned jobs — they are broken from the moment
// they get into this state, so there's no reason to wait 24 hours.
const DEFAULT_STUCK_TIMEOUT_HOURS = 2;

const getRetentionMs = () => {
  const raw = Number(process.env.PAYLOAD_JOBS_FAILED_RETENTION_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RETENTION_HOURS;
  return hours * 60 * 60 * 1000;
};

const getStuckTimeoutMs = () => {
  const raw = Number(process.env.PAYLOAD_JOBS_STUCK_TIMEOUT_HOURS);
  const hours = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_STUCK_TIMEOUT_HOURS;
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
    const stuckMs = getStuckTimeoutMs();
    const retentionCutoff = new Date(Date.now() - retentionMs);
    const stuckCutoff = new Date(Date.now() - stuckMs);
    const cleanupQueue = process.env.PAYLOAD_JOBS_CLEANUP_QUEUE || "cleanup";

    // 1. Failed jobs older than the retention window.
    const failedWhere: Where = {
      and: [
        { hasError: { equals: true } },
        { completedAt: { less_than: retentionCutoff.toISOString() } },
      ],
    };

    // 2. Orphaned pending jobs: never attempted and older than the stuck timeout.
    //    These pile up in queues that have no worker (e.g. "default").
    //    The cleanup queue is excluded to protect its own scheduled pending job.
    const orphanedWhere: Where = {
      and: [
        { processing: { equals: false } },
        { hasError: { equals: false } },
        { totalTried: { equals: 0 } },
        { createdAt: { less_than: stuckCutoff.toISOString() } },
        { queue: { not_equals: cleanupQueue } },
      ],
    };

    // 3. Stuck processing jobs: have been processing far longer than any workflow
    //    should reasonably take. A job stuck in this state blocks the scheduler
    //    from ever starting a new run of that workflow.
    const stuckProcessingWhere: Where = {
      and: [
        { processing: { equals: true } },
        { hasError: { equals: false } },
        { createdAt: { less_than: stuckCutoff.toISOString() } },
      ],
    };

    const [
      { totalDocs: failedCount },
      { totalDocs: orphanedCount },
      { totalDocs: stuckCount },
    ] = await Promise.all([
      payload.count({ collection: "payload-jobs", where: failedWhere }),
      payload.count({ collection: "payload-jobs", where: orphanedWhere }),
      payload.count({ collection: "payload-jobs", where: stuckProcessingWhere }),
    ]);

    const retentionHours = retentionMs / (60 * 60 * 1000);
    const stuckHours = stuckMs / (60 * 60 * 1000);

    if (!failedCount && !orphanedCount && !stuckCount) {
      logger.info({
        msg: "cleanupFailedJobs:: No jobs to delete",
        retentionHours,
        stuckHours,
      });
      return { output: { deletedFailed: 0, deletedOrphaned: 0, deletedStuck: 0 } };
    }

    const deleteOps = [];
    if (failedCount) {
      deleteOps.push(
        payload.delete({ collection: "payload-jobs", where: failedWhere, overrideAccess: true }),
      );
    }
    if (orphanedCount) {
      deleteOps.push(
        payload.delete({ collection: "payload-jobs", where: orphanedWhere, overrideAccess: true }),
      );
    }
    if (stuckCount) {
      deleteOps.push(
        payload.delete({
          collection: "payload-jobs",
          where: stuckProcessingWhere,
          overrideAccess: true,
        }),
      );
    }
    await Promise.all(deleteOps);

    if (stuckCount) {
      logger.warn({
        msg: "cleanupFailedJobs:: Deleted stuck processing jobs — these were processing far longer than expected",
        deletedStuck: stuckCount,
        stuckHours,
      });
    }

    logger.info({
      msg: "cleanupFailedJobs:: Deleted jobs",
      retentionHours,
      stuckHours,
      deletedFailed: failedCount,
      deletedOrphaned: orphanedCount,
      deletedStuck: stuckCount,
    });

    return {
      output: { deletedFailed: failedCount, deletedOrphaned: orphanedCount, deletedStuck: stuckCount },
    };
  }),
};
