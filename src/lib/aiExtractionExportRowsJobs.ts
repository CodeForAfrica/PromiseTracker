import type { PayloadRequest } from "payload";

export const AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE =
  process.env.PAYLOAD_EXPORT_SYNC_QUEUE || "exportSync";

export const AI_EXTRACTION_EXPORT_ROWS_SYNC_CRON_SCHEDULE =
  process.env.PAYLOAD_EXPORT_SYNC_CRON_SCHEDULE || "0 * * * *";

export const AI_EXTRACTION_EXPORT_ROWS_SYNC_LIMIT =
  Number(process.env.PAYLOAD_EXPORT_SYNC_LIMIT) || 100;

// Upper bound on how many waiting jobs the duplicate check scans. With
// deduplication in place the queue should stay far below this.
const QUEUED_JOBS_SCAN_LIMIT = 500;

export type SyncAIExtractionExportRowsInput = {
  aiExtractionId?: string;
  documentId?: string;
  politicalEntityId?: string;
  scope?:
    | "aiExtraction"
    | "all"
    | "document"
    | "politicalEntity"
    | "status"
    | "tenant";
  statusId?: string;
  tenantId?: string;
};

type QueueAIExtractionExportRowsSyncArgs = {
  errorMessage: string;
  input: SyncAIExtractionExportRowsInput;
  logContext: Record<string, unknown>;
  req: PayloadRequest;
};

const SYNC_INPUT_KEYS = [
  "aiExtractionId",
  "documentId",
  "politicalEntityId",
  "scope",
  "statusId",
  "tenantId",
] as const;

const isSameSyncInput = (
  a: SyncAIExtractionExportRowsInput,
  b: SyncAIExtractionExportRowsInput,
): boolean =>
  SYNC_INPUT_KEYS.every((key) => (a[key] ?? null) === (b[key] ?? null));

// Every scoped sync ultimately iterates AI extractions (or export rows that
// only exist because of one), so with no extractions the job is a no-op.
// This runs inside the caller's transaction: `pagination: false` is required
// because Mongo's count command is not allowed in multi-document transactions,
// and a rejected count aborts the whole transaction around the hook.
const hasAIExtractionsToSync = async (req: PayloadRequest): Promise<boolean> => {
  const { docs } = await req.payload.find({
    collection: "ai-extractions",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    select: {},
  });
  return docs.length > 0;
};

const hasQueuedDuplicate = async (
  input: SyncAIExtractionExportRowsInput,
  req: PayloadRequest,
): Promise<boolean> => {
  const { docs: waitingJobs } = await req.payload.find({
    collection: "payload-jobs",
    depth: 0,
    limit: QUEUED_JOBS_SCAN_LIMIT,
    overrideAccess: true,
    pagination: false,
    req,
    select: {
      input: true,
    },
    where: {
      and: [
        { taskSlug: { equals: "syncAIExtractionExportRows" } },
        { queue: { equals: AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE } },
        // A job that is already running may have read state from before this
        // change, so only jobs still waiting to start count as duplicates.
        { processing: { equals: false } },
        { hasError: { not_equals: true } },
        { completedAt: { exists: false } },
      ],
    },
  });

  return waitingJobs.some((job) => {
    if (!job.input || typeof job.input !== "object") {
      return false;
    }
    const queuedInput = job.input as SyncAIExtractionExportRowsInput;
    // A waiting full rebuild subsumes every scoped sync.
    if (queuedInput.scope === "all") {
      return true;
    }
    return isSameSyncInput(queuedInput, input);
  });
};

export const queueAIExtractionExportRowsSync = async ({
  errorMessage,
  input,
  logContext,
  req,
}: QueueAIExtractionExportRowsSyncArgs): Promise<void> => {
  // The guards only skip work; if they fail, fall through and queue anyway.
  try {
    // A sync queued from an AI extraction change implies extractions exist.
    if (input.scope !== "aiExtraction" && !(await hasAIExtractionsToSync(req))) {
      return;
    }

    if (await hasQueuedDuplicate(input, req)) {
      return;
    }
  } catch (err) {
    req.payload.logger.warn({
      ...logContext,
      err,
      msg: "Failed to check for duplicate export row sync jobs — queueing anyway",
    });
  }

  try {
    await req.payload.jobs.queue({
      input,
      overrideAccess: true,
      queue: AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE,
      req,
      task: "syncAIExtractionExportRows",
    });
  } catch (err) {
    req.payload.logger.error({
      ...logContext,
      err,
      msg: errorMessage,
    });
  }
};
