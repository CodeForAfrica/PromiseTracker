import type { Payload } from "payload";

export const WORKFLOW_LOCKS_COLLECTION = "workflow-locks" as const;

/**
 * How long a lock stays valid without being released. A crashed run's lock
 * expires after this TTL so the workflow is not blocked forever; matches the
 * intent of the stuck-job cleanup (PAYLOAD_JOBS_STUCK_TIMEOUT_HOURS).
 */
export const DEFAULT_WORKFLOW_LOCK_TTL_MS = 2 * 60 * 60 * 1_000;

type MongoLikeModel = {
  findOneAndUpdate: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options: Record<string, unknown>,
  ) => { lean?: () => Promise<unknown> } | Promise<unknown>;
};

const getModel = (payload: Payload): MongoLikeModel => {
  const collections = (
    payload.db as unknown as {
      collections?: Record<string, MongoLikeModel>;
    }
  ).collections;
  const model = collections?.[WORKFLOW_LOCKS_COLLECTION];
  if (!model) {
    throw new Error(
      `workflowLocks:: collection "${WORKFLOW_LOCKS_COLLECTION}" is not registered on the database adapter`,
    );
  }
  return model;
};

const run = async (
  model: MongoLikeModel,
  filter: Record<string, unknown>,
  update: Record<string, unknown>,
  options: Record<string, unknown>,
): Promise<Record<string, unknown> | null> => {
  const query = model.findOneAndUpdate(filter, update, options);
  const result =
    query && typeof (query as { lean?: unknown }).lean === "function"
      ? await (query as { lean: () => Promise<unknown> }).lean()
      : await query;
  return (result as Record<string, unknown> | null) ?? null;
};

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: number }).code === 11000;

/**
 * Atomically acquires the run lock for a workflow. Returns true when this
 * run now holds the lock; false when another run already holds a live lock.
 * A lock is acquirable when no document exists, the previous run released it
 * (status "idle"), or the previous lock expired (crashed run).
 */
export const acquireWorkflowLock = async (
  payload: Payload,
  {
    workflow,
    runId,
    ttlMs = DEFAULT_WORKFLOW_LOCK_TTL_MS,
    now = () => new Date(),
  }: {
    workflow: string;
    runId: string;
    ttlMs?: number;
    now?: () => Date;
  },
): Promise<boolean> => {
  const model = getModel(payload);
  const nowDate = now();

  try {
    const doc = await run(
      model,
      {
        workflow,
        $or: [
          { status: { $ne: "running" } },
          { expiresAt: { $lt: nowDate } },
          { expiresAt: null },
        ],
      },
      {
        $set: {
          workflow,
          runId,
          status: "running",
          lockedAt: nowDate,
          expiresAt: new Date(nowDate.getTime() + ttlMs),
        },
      },
      { upsert: true, new: true },
    );

    return doc?.runId === runId;
  } catch (error) {
    // Upsert raced another acquirer on the unique workflow index — the other
    // run holds the lock.
    if (isDuplicateKeyError(error)) {
      return false;
    }
    throw error;
  }
};

/**
 * Releases the lock, but only if this run still owns it — a lock taken over
 * after expiry must not be released by the stale run.
 */
export const releaseWorkflowLock = async (
  payload: Payload,
  { workflow, runId }: { workflow: string; runId: string },
): Promise<void> => {
  const model = getModel(payload);
  await run(
    model,
    { workflow, runId, status: "running" },
    { $set: { status: "idle" } },
    { new: true },
  );
};
