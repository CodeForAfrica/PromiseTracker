import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/payload", () => ({
  getGlobalPayload: vi.fn(async () => ({
    find: findMock,
    update: updateMock,
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) =>
    callback({
      setContext: vi.fn(),
      setLevel: vi.fn(),
      setTag: vi.fn(),
    }),
  ),
}));

import { POST } from "@/app/api/meedan-sync/route";

const SECRET = "test-webhook-secret";
const PROJECT_MEDIA_GLOBAL_ID = Buffer.from(
  "ProjectMedia/456",
  "utf8",
).toString("base64");

const buildRequest = (body: Record<string, unknown>): NextRequest =>
  new NextRequest("http://localhost:3000/api/meedan-sync", {
    body: JSON.stringify(body),
    headers: {
      authorization: SECRET,
      "content-type": "application/json",
    },
    method: "POST",
  });

const webhookBody = {
  data: { id: "annotation-123" },
  object: {
    annotated_id: 456,
    annotated_type: "ProjectMedia",
    annotation_type: "report_design",
    data: {
      options: { title: "Updated title" },
      state: "published",
    },
  },
};

describe("meedan-sync webhook", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET_KEY = SECRET;
    findMock.mockReset();
    updateMock.mockReset();
    updateMock.mockImplementation(async ({ id, data }) => ({
      id,
      ...data,
    }));
  });

  it("does not overwrite an existing canonical meedanId", async () => {
    findMock.mockResolvedValue({
      docs: [
        {
          id: "promise-1",
          meedanId: PROJECT_MEDIA_GLOBAL_ID,
          title: "Old title",
        },
      ],
    });

    const response = await POST(buildRequest(webhookBody));

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const updateData = updateMock.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("meedanId");
    expect(updateData.title).toBe("Updated title");
  });

  it("backfills a missing meedanId with the ProjectMedia global ID", async () => {
    findMock.mockResolvedValue({
      docs: [
        {
          id: "promise-1",
          meedanId: "",
          title: "Old title",
        },
      ],
    });

    const response = await POST(buildRequest(webhookBody));

    expect(response.status).toBe(200);
    const updateData = updateMock.mock.calls[0][0].data;
    expect(updateData.meedanId).toBe(PROJECT_MEDIA_GLOBAL_ID);
    expect(updateData.meedanId).not.toBe("annotation-123");
  });

  it("prefers the canonical promise when duplicates match the lookup", async () => {
    findMock.mockResolvedValue({
      docs: [
        {
          id: "promise-orphan",
          meedanId: "annotation-123",
          title: "Old title",
        },
        {
          id: "promise-canonical",
          meedanId: PROJECT_MEDIA_GLOBAL_ID,
          title: "Old title",
        },
      ],
    });

    const response = await POST(buildRequest(webhookBody));

    expect(response.status).toBe(200);
    expect(updateMock.mock.calls[0][0].id).toBe("promise-canonical");
  });

  it("returns 404 when no promise matches", async () => {
    findMock.mockResolvedValue({ docs: [] });

    const response = await POST(buildRequest(webhookBody));

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
