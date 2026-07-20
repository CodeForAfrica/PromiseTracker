import { randomUUID } from "node:crypto";
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

const buildRequest = (
  body: Record<string, unknown>,
  { secret = SECRET }: { secret?: string } = {},
): NextRequest =>
  new NextRequest("http://localhost:3000/api/meedan-sync", {
    body: JSON.stringify(body),
    headers: {
      authorization: secret,
      "content-type": "application/json",
    },
    method: "POST",
  });

// The route keeps a module-level idempotency cache keyed by the raw body, so
// every test that expects fresh processing must use a unique body.
const buildWebhookBody = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  data: { id: "annotation-123" },
  object: {
    annotated_id: 456,
    annotated_type: "ProjectMedia",
    annotation_type: "report_design",
    data: {
      options: { title: "Updated title" },
      state: "published",
    },
    ...overrides,
  },
  nonce: randomUUID(),
});

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

  it("rejects requests with a wrong secret", async () => {
    const response = await POST(
      buildRequest(buildWebhookBody(), { secret: "wrong-secret" }),
    );

    expect(response.status).toBe(401);
    expect(findMock).not.toHaveBeenCalled();
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

    const response = await POST(buildRequest(buildWebhookBody()));

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

    const response = await POST(buildRequest(buildWebhookBody()));

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

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(response.status).toBe(200);
    expect(updateMock.mock.calls[0][0].id).toBe("promise-canonical");
  });

  it("returns 404 when no promise matches", async () => {
    findMock.mockResolvedValue({ docs: [] });

    const response = await POST(buildRequest(buildWebhookBody()));

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  describe("duplicate delivery / replay protection", () => {
    it("replays the recorded response for a duplicate delivery without re-processing", async () => {
      findMock.mockResolvedValue({
        docs: [
          {
            id: "promise-1",
            meedanId: PROJECT_MEDIA_GLOBAL_ID,
            title: "Old title",
          },
        ],
      });

      const body = buildWebhookBody();

      const first = await POST(buildRequest(body));
      expect(first.status).toBe(200);
      expect(updateMock).toHaveBeenCalledTimes(1);

      const second = await POST(buildRequest(body));
      expect(second.status).toBe(200);
      const replayedBody = await second.json();
      expect(replayedBody.replayed).toBe(true);
      // The duplicate delivery did not update the promise again.
      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(findMock).toHaveBeenCalledTimes(1);
    });

    it("still requires a valid secret to replay", async () => {
      findMock.mockResolvedValue({
        docs: [
          {
            id: "promise-1",
            meedanId: PROJECT_MEDIA_GLOBAL_ID,
            title: "Old title",
          },
        ],
      });

      const body = buildWebhookBody();
      await POST(buildRequest(body));

      const replayWithBadSecret = await POST(
        buildRequest(body, { secret: "wrong" }),
      );
      expect(replayWithBadSecret.status).toBe(401);
    });

    it("rejects a concurrent duplicate while the original is in flight", async () => {
      let resolveFind: (value: unknown) => void = () => {};
      findMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFind = resolve;
          }),
      );

      const body = buildWebhookBody();

      const firstPromise = POST(buildRequest(body));
      // Give the first request time to register as in-flight.
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = await POST(buildRequest(body));
      expect(second.status).toBe(409);

      resolveFind({
        docs: [
          {
            id: "promise-1",
            meedanId: PROJECT_MEDIA_GLOBAL_ID,
            title: "Old title",
          },
        ],
      });
      const first = await firstPromise;
      expect(first.status).toBe(200);
    });
  });

  describe("image URL hardening", () => {
    beforeEach(() => {
      findMock.mockResolvedValue({
        docs: [
          {
            id: "promise-1",
            meedanId: PROJECT_MEDIA_GLOBAL_ID,
            title: "Old title",
          },
        ],
      });
    });

    const bodyWithImage = (url: string) =>
      buildWebhookBody({
        file: [{ url }],
      });

    it("rejects image URLs on hosts outside the allowlist", async () => {
      const response = await POST(
        buildRequest(bodyWithImage("https://evil.example.com/img.png")),
      );

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody.error).toBe("Invalid image URL");
    });

    it("rejects plain HTTP image URLs", async () => {
      const response = await POST(
        buildRequest(bodyWithImage("http://assets.checkmedia.org/img.png")),
      );

      expect(response.status).toBe(400);
    });

    it("rejects image URLs pointing at cloud metadata addresses", async () => {
      const response = await POST(
        buildRequest(bodyWithImage("https://169.254.169.254/latest/meta-data")),
      );

      expect(response.status).toBe(400);
    });
  });
});
