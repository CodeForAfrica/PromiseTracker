import { CleanupFailedJobs } from "@/tasks/cleanupFailedJobs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  startSpan: vi.fn(async (_options, callback) => callback()),
}));

describe("CleanupFailedJobs", () => {
  it("includes exportSync jobs in orphaned job cleanup", async () => {
    const logger = {
      child: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    logger.child.mockReturnValue(logger);

    const payload = {
      count: vi
        .fn()
        .mockResolvedValueOnce({ totalDocs: 0 })
        .mockResolvedValueOnce({ totalDocs: 0 })
        .mockResolvedValueOnce({ totalDocs: 0 }),
      delete: vi.fn(),
      logger,
    };

    if (typeof CleanupFailedJobs.handler !== "function") {
      throw new Error("CleanupFailedJobs handler is not available");
    }

    const result = await CleanupFailedJobs.handler({
      input: {},
      req: { payload } as never,
    } as never);

    expect(result).toEqual({
      output: { deletedFailed: 0, deletedOrphaned: 0, deletedStuck: 0 },
    });

    const orphanedWhere = payload.count.mock.calls[1][0].where;

    expect(orphanedWhere).toEqual({
      and: [
        { processing: { equals: false } },
        { hasError: { equals: false } },
        { totalTried: { equals: 0 } },
        { createdAt: { less_than: expect.any(String) } },
        { queue: { not_equals: "cleanup" } },
      ],
    });
  });
});
