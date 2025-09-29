import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import { isProd } from "@/utils/utils";
import { defineWorkflow } from "./utils";

export const meedanWorkflow = defineWorkflow({
  slug: "meedanWorkflow",
  label: "Meedan Workflow",
  schedule: [
    {
      cron: "* * * * *",
      queue: "everyMinute",
    },
  ],
  handler: async ({ tasks }) => {
    await tasks.fetchPromiseStatuses(randomUUID(), {
      input: [],
    });
    await tasks.updatePromiseStatus(randomUUID(), {
      input: [],
    });
    await tasks.syncMeedanPromises(randomUUID(), {
      input: [],
    });
  },
} satisfies WorkflowConfig);
