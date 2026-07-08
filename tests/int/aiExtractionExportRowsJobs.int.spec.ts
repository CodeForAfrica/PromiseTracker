import type { PayloadRequest } from "payload";
import { describe, expect, it, vi } from "vitest";

import {
  AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE,
  queueAIExtractionExportRowsSync,
} from "@/lib/aiExtractionExportRowsJobs";

type MockOverrides = {
  aiExtractionCount?: number;
  waitingJobInputs?: Array<Record<string, unknown>>;
  findError?: Error;
};

const buildReq = ({
  aiExtractionCount = 1,
  waitingJobInputs = [],
  findError,
}: MockOverrides = {}) => {
  type FindArgs = {
    collection: string;
    pagination?: boolean;
    where?: { and?: unknown[] };
  };
  const find = vi.fn(async ({ collection }: FindArgs) => {
    if (findError) {
      throw findError;
    }
    if (collection === "ai-extractions") {
      return {
        docs: Array.from({ length: Math.min(aiExtractionCount, 1) }, () => ({
          id: "extraction-1",
        })),
      };
    }
    return { docs: waitingJobInputs.map((input) => ({ input })) };
  });
  const queue = vi.fn().mockResolvedValue({});
  const logger = { error: vi.fn(), warn: vi.fn() };

  const req = {
    payload: { find, jobs: { queue }, logger },
  } as unknown as PayloadRequest;

  return { find, logger, queue, req };
};

const queueSync = (
  req: PayloadRequest,
  input: Record<string, unknown> = { documentId: "doc-1", scope: "document" },
) =>
  queueAIExtractionExportRowsSync({
    errorMessage: "failed",
    input,
    logContext: {},
    req,
  });

describe("queueAIExtractionExportRowsSync", () => {
  it("queues a job when there is no waiting duplicate", async () => {
    const { find, queue, req } = buildReq({
      waitingJobInputs: [{ documentId: "doc-2", scope: "document" }],
    });

    await queueSync(req);

    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { documentId: "doc-1", scope: "document" },
        queue: AI_EXTRACTION_EXPORT_ROWS_SYNC_QUEUE,
        task: "syncAIExtractionExportRows",
      }),
    );

    const where = find.mock.calls[1][0].where;
    expect(where?.and).toEqual(
      expect.arrayContaining([
        { taskSlug: { equals: "syncAIExtractionExportRows" } },
        { processing: { equals: false } },
        { hasError: { not_equals: true } },
      ]),
    );
  });

  it("skips queueing when an identical job is already waiting", async () => {
    const { queue, req } = buildReq({
      waitingJobInputs: [{ documentId: "doc-1", scope: "document" }],
    });

    await queueSync(req);

    expect(queue).not.toHaveBeenCalled();
  });

  it("skips queueing when there are no AI extractions", async () => {
    const { find, queue, req } = buildReq({ aiExtractionCount: 0 });

    await queueSync(req);

    expect(queue).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        collection: "ai-extractions",
        pagination: false,
      }),
    );
  });

  it("skips the extraction existence check for aiExtraction-scoped syncs", async () => {
    const { find, queue, req } = buildReq({ aiExtractionCount: 0 });

    await queueSync(req, { aiExtractionId: "ext-1", scope: "aiExtraction" });

    expect(queue).toHaveBeenCalled();
    expect(
      find.mock.calls.filter(
        (call) => call[0].collection === "ai-extractions",
      ),
    ).toHaveLength(0);
  });

  it("skips scoped syncs when a full rebuild is already waiting", async () => {
    const { queue, req } = buildReq({
      waitingJobInputs: [{ scope: "all" }],
    });

    await queueSync(req, { politicalEntityId: "entity-1", scope: "politicalEntity" });

    expect(queue).not.toHaveBeenCalled();
  });

  it("treats missing and undefined input fields as equal", async () => {
    const { queue, req } = buildReq({
      waitingJobInputs: [{ scope: "all" }],
    });

    await queueSync(req, { scope: "all", documentId: undefined });

    expect(queue).not.toHaveBeenCalled();
  });

  it("queues anyway when the duplicate check fails", async () => {
    const { logger, queue, req } = buildReq({
      findError: new Error("db unavailable"),
    });

    await queueSync(req);

    expect(queue).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
