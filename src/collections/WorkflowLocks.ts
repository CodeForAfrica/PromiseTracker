import type { CollectionConfig } from "payload";

/**
 * System collection backing the atomic queued/running guard for scheduled
 * workflows. One document per workflow slug; acquisition happens through an
 * atomic findOneAndUpdate (see src/lib/workflowLocks.ts), never through the
 * Payload API, so overlapping cron runs can never both hold the lock.
 */
export const WorkflowLocks: CollectionConfig = {
  slug: "workflow-locks",
  admin: {
    hidden: true,
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: "workflow",
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "runId",
      type: "text",
    },
    {
      name: "status",
      type: "select",
      options: ["idle", "running"],
      defaultValue: "idle",
    },
    {
      name: "lockedAt",
      type: "date",
    },
    {
      name: "expiresAt",
      type: "date",
    },
  ],
};
