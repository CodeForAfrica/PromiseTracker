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

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: (...args: unknown[]) => generateText(...args),
}));

vi.mock("@/lib/ai/providerRegistry", () => ({
  resolveConfiguredLanguageModel: vi.fn(() => ({
    model: { id: "mock-model" },
    modelId: "mock-model",
    providerId: "mock-provider",
  })),
}));

vi.mock("@/lib/airtable", () => ({
  updateDocumentStatus: vi.fn(),
}));

vi.mock("@payloadcms/richtext-lexical/plaintext", () => ({
  convertLexicalToPlaintext: vi.fn(
    ({ data }: { data: { text: string } }) => data.text,
  ),
}));

import { ExtractPromises } from "@/tasks/extractPromises";

const buildLogger = () => {
  const logger = {
    child: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
};

const buildPayload = ({
  documentText,
  limits,
}: {
  documentText: string;
  limits: Record<string, number>;
}) => {
  const logger = buildLogger();
  const document = {
    id: "doc-1",
    title: "Manifesto",
    airtableID: null,
    fullyProcessed: false,
    extractedText: [{ text: { text: documentText } }],
  };

  const payload = {
    logger,
    findGlobal: vi.fn().mockResolvedValue({
      airtable: { airtableAPIKey: null },
      ai: { limits },
    }),
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === "documents") {
        return { docs: [document], hasNextPage: false };
      }
      return { docs: [], hasNextPage: false };
    }),
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: "extraction-1" }),
    delete: vi.fn(),
  };

  return { payload, document };
};

const runHandler = async (payload: unknown) => {
  if (typeof ExtractPromises.handler !== "function") {
    throw new Error("ExtractPromises handler is not available");
  }
  return ExtractPromises.handler({
    input: {},
    req: { payload } as never,
  } as never);
};

describe("extractPromises document guards", () => {
  it("rejects oversized documents into the operator-review state without any AI call", async () => {
    generateText.mockReset();
    const { payload } = buildPayload({
      documentText: "a".repeat(500),
      limits: { maxDocumentChars: 100 },
    });

    await runHandler(payload);

    expect(generateText).not.toHaveBeenCalled();
    expect(payload.create).not.toHaveBeenCalled();

    const reviewUpdate = payload.update.mock.calls.find(
      ([args]) => args.data?.extractionReview,
    );
    expect(reviewUpdate).toBeDefined();
    expect(reviewUpdate?.[0].data.extractionReview).toMatchObject({
      status: "rejected",
      reason: expect.stringContaining("exceeds"),
    });
  });

  it("processes documents within the character ceiling", async () => {
    generateText.mockReset();
    // Pass one returns no candidates for the single chunk; normalization is
    // then called and must finalize.
    generateText
      .mockResolvedValueOnce({
        output: [],
        usage: { inputTokens: 10, outputTokens: 5 },
      })
      .mockResolvedValueOnce({
        steps: [
          {
            toolCalls: [{ toolName: "finalizeExtraction" }],
          },
        ],
        usage: { inputTokens: 10, outputTokens: 5 },
      });

    const { payload } = buildPayload({
      documentText: "We will build 100 hospitals.",
      limits: { maxDocumentChars: 10_000 },
    });

    await runHandler(payload);

    expect(generateText).toHaveBeenCalled();
    // Every AI call must carry a per-call deadline.
    for (const [args] of generateText.mock.calls) {
      expect(args.abortSignal).toBeInstanceOf(AbortSignal);
      expect(args.maxRetries).toBe(0);
    }

    const processedUpdate = payload.update.mock.calls.find(
      ([args]) => args.data?.fullyProcessed === true,
    );
    expect(processedUpdate).toBeDefined();
  });
});
