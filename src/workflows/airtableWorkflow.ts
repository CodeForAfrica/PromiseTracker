import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import { defineWorkflow, runTask } from "./utils";

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
    await runTask(
      () => tasks.createTenantFromAirtable(randomUUID(), { input: {} }),
      "createTenantFromAirtable",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.createPoliticalEntity(randomUUID(), { input: {} }),
      "createPoliticalEntity",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.fetchAirtableDocuments(randomUUID(), { input: {} }),
      "fetchAirtableDocuments",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.downloadDocuments(randomUUID(), { input: {} }),
      "downloadDocuments",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.extractDocuments(randomUUID(), { input: {} }),
      "extractDocuments",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.extractPromises(randomUUID(), { input: {} }),
      "extractPromises",
      "airtableWorkflow",
    );
    await runTask(
      () => tasks.uploadToMeedan(randomUUID(), { input: {} }),
      "uploadToMeedan",
      "airtableWorkflow",
    );
  },
} satisfies WorkflowConfig);
