import type { PayloadRequest } from "payload";

export const AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE =
  process.env.PAYLOAD_JOBS_QUEUE || "everyMinute";

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

export const queueAIExtractionExportRowsSync = async ({
  errorMessage,
  input,
  logContext,
  req,
}: QueueAIExtractionExportRowsSyncArgs): Promise<void> => {
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
