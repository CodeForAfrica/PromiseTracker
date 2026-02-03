import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import { defineWorkflow } from "./utils";

export const airtableWorkflow = defineWorkflow({
  slug: "airtableWorkflow",
  label: "Airtable Workflow",
  schedule: [
    {
      cron: process.env.PAYLOAD_JOBS_CRON_SCHEDULE || "* * * * *",
      queue: process.env.PAYLOAD_JOBS_QUEUE || "everyMinute",
    },
  ],
  handler: async ({ tasks }) => {
    await tasks.createTenantFromAirtable(randomUUID(), {
      input: {},
    });
    await tasks.createPoliticalEntity(randomUUID(), {
      input: {},
    });
    await tasks.fetchAirtableDocuments(randomUUID(), {
      input: {},
    });
    await tasks.downloadDocuments(randomUUID(), {
      input: {},
    });
    await tasks.extractDocuments(randomUUID(), {
      input: {},
    });
    await tasks.extractPromises(randomUUID(), {
      input: {},
    });
    await tasks.uploadToMeedan(randomUUID(), {
      input: {},
    });
  },
} satisfies WorkflowConfig);
