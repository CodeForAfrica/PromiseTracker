import { TaskConfig, type Where } from "payload";
import { getTaskLogger, withTaskTracing } from "./utils";

const getCleanupQueue = () =>
  process.env.PAYLOAD_JOBS_CLEANUP_QUEUE || "cleanup";

export const CleanupFailedJobs: TaskConfig<"cleanupFailedJobs"> = {
  slug: "cleanupFailedJobs",
  label: "Cleanup Failed Jobs",
  retries: 1,
  schedule: [
    {
      cron: "0 * * * *",
      queue: getCleanupQueue(),
    },
  ],
  handler: withTaskTracing("cleanupFailedJobs", async ({ req, input }) => {
    const { payload } = req;
    const logger = getTaskLogger(req, "cleanupFailedJobs", input);

    const where: Where = {
      and: [
        { processing: { not_equals: true } },
        { taskSlug: { not_equals: "cleanupFailedJobs" } },
      ],
    };

    const { totalDocs } = await payload.count({
      collection: "payload-jobs",
      where,
    });

    if (!totalDocs) {
      logger.info({ msg: "cleanupFailedJobs:: No jobs to delete" });
      return { output: { deleted: 0 } };
    }

    await payload.delete({
      collection: "payload-jobs",
      where,
      overrideAccess: true,
    });

    logger.info({
      msg: "cleanupFailedJobs:: Deleted all non-processing jobs",
      deleted: totalDocs,
    });

    return { output: { deleted: totalDocs } };
  }),
};
