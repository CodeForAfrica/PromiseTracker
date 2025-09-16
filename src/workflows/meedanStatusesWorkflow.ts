import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import { isProd } from "@/utils/utils";

export const meedanStatusesWorkflow: WorkflowConfig = {
  slug: "meedanStatusesWorkflow",
  label: "Meedan Statuses Workflow",
  schedule: [
    {
      cron: isProd ? "0 * * * *" : "* * * * *",
      queue: isProd ? "hourly" : "everyMinute",
    },
  ],
  handler: async ({ tasks }) => {
    await tasks.fetchPromiseStatuses(randomUUID(), {
      input: [],
    });
  },
};

