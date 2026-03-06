import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import { defineWorkflow, runTask } from "./utils";

export const meedanWorkflow = defineWorkflow({
  slug: "meedanWorkflow",
  label: "Meedan Workflow",
  schedule: [
    {
      cron: process.env.PAYLOAD_JOBS_CRON_SCHEDULE || "* * * * *",
      queue: process.env.PAYLOAD_JOBS_QUEUE || "everyMinute",
    },
  ],
  handler: async ({ tasks }) => {
    await runTask(
      () => tasks.fetchPromiseStatuses(randomUUID(), { input: {} }),
      "fetchPromiseStatuses",
    );
    await runTask(
      () => tasks.updatePromiseStatus(randomUUID(), { input: {} }),
      "updatePromiseStatus",
    );
    await runTask(
      () => tasks.syncMeedanPromises(randomUUID(), { input: {} }),
      "syncMeedanPromises",
    );
  },
} satisfies WorkflowConfig);
