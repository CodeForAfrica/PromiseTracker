import { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { acquireWorkflowLock, releaseWorkflowLock } from "@/lib/workflowLocks";
import { defineWorkflow, runTask } from "./utils";

const WORKFLOW_SLUG = "airtableWorkflow";

export const airtableWorkflow = defineWorkflow({
  slug: WORKFLOW_SLUG,
  label: "Airtable Workflow",
  schedule: [
    {
      cron: process.env.PAYLOAD_JOBS_CRON_SCHEDULE || "* * * * *",
      queue: process.env.PAYLOAD_JOBS_QUEUE || "everyMinute",
    },
  ],
  handler: async ({ tasks, job, req }) => {
    const { payload } = req;
    const runId = String(job?.id ?? randomUUID());

    // Atomic queued/running guard: the every-minute cron must never stack a
    // second run over the same work while a previous run is still going.
    const acquired = await acquireWorkflowLock(payload, {
      workflow: WORKFLOW_SLUG,
      runId,
    });

    if (!acquired) {
      payload.logger.warn({
        message:
          "airtableWorkflow:: Skipping run — previous run still holds the workflow lock",
        workflow: WORKFLOW_SLUG,
        runId,
      });
      // Overlap/pileup signal for alerting: repeated occurrences mean runs
      // take longer than the schedule interval.
      Sentry.logger.warn("workflow.overlap_skipped", {
        log_source: "payload.workflow",
        workflow: WORKFLOW_SLUG,
        workflowRunId: runId,
      });
      return;
    }

    try {
      await runWorkflowTasks(tasks);
    } finally {
      await releaseWorkflowLock(payload, {
        workflow: WORKFLOW_SLUG,
        runId,
      });
    }
  },
} satisfies WorkflowConfig);

type WorkflowHandlerFn = Extract<
  NonNullable<WorkflowConfig["handler"]>,
  (...args: never[]) => unknown
>;
type WorkflowTasks = Parameters<WorkflowHandlerFn>[0]["tasks"];

async function runWorkflowTasks(tasks: WorkflowTasks) {
  await runTask(
    () => tasks.createTenantFromAirtable(randomUUID(), { input: {} }),
    "createTenantFromAirtable",
  );
  await runTask(
    () => tasks.createPoliticalEntity(randomUUID(), { input: {} }),
    "createPoliticalEntity",
  );
  await runTask(
    () => tasks.fetchAirtableDocuments(randomUUID(), { input: {} }),
    "fetchAirtableDocuments",
  );
  await runTask(
    () => tasks.downloadDocuments(randomUUID(), { input: {} }),
    "downloadDocuments",
  );
  await runTask(
    () => tasks.extractDocuments(randomUUID(), { input: {} }),
    "extractDocuments",
  );
  await runTask(
    () => tasks.extractPromises(randomUUID(), { input: {} }),
    "extractPromises",
  );
  await runTask(
    () => tasks.uploadToMeedan(randomUUID(), { input: {} }),
    "uploadToMeedan",
  );
}
