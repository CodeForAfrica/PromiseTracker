import { describe, expect, it, vi } from "vitest";
import type { Payload } from "payload";

import {
  acquireWorkflowLock,
  releaseWorkflowLock,
  WORKFLOW_LOCKS_COLLECTION,
} from "@/lib/workflowLocks";

const buildPayload = (
  findOneAndUpdate: ReturnType<typeof vi.fn>,
): Payload =>
  ({
    db: {
      collections: {
        [WORKFLOW_LOCKS_COLLECTION]: { findOneAndUpdate },
      },
    },
  }) as unknown as Payload;

describe("workflow run locks (duplicate scheduling guard)", () => {
  it("acquires the lock when no other run holds it", async () => {
    const findOneAndUpdate = vi.fn().mockReturnValue({
      lean: () =>
        Promise.resolve({ workflow: "airtableWorkflow", runId: "run-1" }),
    });

    const acquired = await acquireWorkflowLock(buildPayload(findOneAndUpdate), {
      workflow: "airtableWorkflow",
      runId: "run-1",
    });

    expect(acquired).toBe(true);

    const [filter, update, options] = findOneAndUpdate.mock.calls[0];
    expect(filter.workflow).toBe("airtableWorkflow");
    expect(filter.$or).toBeDefined();
    expect(update.$set.status).toBe("running");
    expect(update.$set.expiresAt).toBeInstanceOf(Date);
    expect(options).toMatchObject({ upsert: true, new: true });
  });

  it("refuses a duplicate run while another run holds a live lock", async () => {
    // The atomic filter does not match a live "running" lock, so the second
    // scheduler tick gets no document back.
    const findOneAndUpdate = vi.fn().mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    const acquired = await acquireWorkflowLock(buildPayload(findOneAndUpdate), {
      workflow: "airtableWorkflow",
      runId: "run-2",
    });

    expect(acquired).toBe(false);
  });

  it("treats a duplicate-key upsert race as lock not acquired", async () => {
    const duplicateKeyError = Object.assign(new Error("E11000"), {
      code: 11000,
    });
    const findOneAndUpdate = vi.fn().mockReturnValue({
      lean: () => Promise.reject(duplicateKeyError),
    });

    const acquired = await acquireWorkflowLock(buildPayload(findOneAndUpdate), {
      workflow: "airtableWorkflow",
      runId: "run-3",
    });

    expect(acquired).toBe(false);
  });

  it("takes over an expired lock from a crashed run", async () => {
    const findOneAndUpdate = vi.fn().mockReturnValue({
      lean: () =>
        Promise.resolve({ workflow: "airtableWorkflow", runId: "run-4" }),
    });

    const acquired = await acquireWorkflowLock(buildPayload(findOneAndUpdate), {
      workflow: "airtableWorkflow",
      runId: "run-4",
    });

    expect(acquired).toBe(true);
    const [filter] = findOneAndUpdate.mock.calls[0];
    // Filter must allow acquiring when the previous lock expired.
    expect(JSON.stringify(filter.$or)).toContain("expiresAt");
  });

  it("only releases a lock still owned by the releasing run", async () => {
    const findOneAndUpdate = vi.fn().mockReturnValue({
      lean: () => Promise.resolve(null),
    });

    await releaseWorkflowLock(buildPayload(findOneAndUpdate), {
      workflow: "airtableWorkflow",
      runId: "run-5",
    });

    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({
      workflow: "airtableWorkflow",
      runId: "run-5",
      status: "running",
    });
    expect(update.$set.status).toBe("idle");
  });
});
