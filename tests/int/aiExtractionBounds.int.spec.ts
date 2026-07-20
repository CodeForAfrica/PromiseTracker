import { describe, expect, it, vi } from "vitest";
import { APICallError } from "ai";

import {
  createDocumentBudget,
  ExtractionBudgetExceededError,
} from "@/lib/ai/documentBudget";
import {
  DEFAULT_EXTRACTION_LIMITS,
  resolveExtractionLimits,
} from "@/lib/ai/extractionLimits";
import {
  callAIWithRetry,
  computeBackoffDelayMs,
  getRetryAfterMs,
  RetryExhaustedError,
} from "@/lib/ai/retry";

const apiError = (options: {
  statusCode?: number;
  isRetryable?: boolean;
  responseHeaders?: Record<string, string>;
}) =>
  new APICallError({
    message: "provider error",
    url: "https://provider.example/v1",
    requestBodyValues: {},
    statusCode: options.statusCode,
    isRetryable: options.isRetryable,
    responseHeaders: options.responseHeaders,
  });

describe("extraction limits", () => {
  it("falls back to defaults when settings provide nothing", () => {
    expect(resolveExtractionLimits(undefined)).toEqual(
      DEFAULT_EXTRACTION_LIMITS,
    );
    expect(resolveExtractionLimits({ limits: null })).toEqual(
      DEFAULT_EXTRACTION_LIMITS,
    );
  });

  it("applies positive overrides and ignores invalid ones", () => {
    const limits = resolveExtractionLimits({
      limits: {
        perCallTimeoutMs: 5_000,
        maxDocumentChars: -10,
        maxTokensPerDocument: "250000",
        maxCostUsdPerDocument: Number.NaN,
      },
    });

    expect(limits.perCallTimeoutMs).toBe(5_000);
    expect(limits.maxTokensPerDocument).toBe(250_000);
    expect(limits.maxDocumentChars).toBe(
      DEFAULT_EXTRACTION_LIMITS.maxDocumentChars,
    );
    expect(limits.maxCostUsdPerDocument).toBe(
      DEFAULT_EXTRACTION_LIMITS.maxCostUsdPerDocument,
    );
  });
});

describe("document budget ceilings", () => {
  const limits = {
    ...DEFAULT_EXTRACTION_LIMITS,
    maxDocumentDurationMs: 1_000,
    maxTokensPerDocument: 100,
    maxCostUsdPerDocument: 0.001,
    inputCostUsdPerMillionTokens: 100,
    outputCostUsdPerMillionTokens: 100,
  };

  it("throws once the total duration ceiling is crossed", () => {
    let nowMs = 0;
    const budget = createDocumentBudget(limits, () => nowMs);

    expect(() => budget.assertWithinBudget()).not.toThrow();

    nowMs = 1_001;
    expect(() => budget.assertWithinBudget()).toThrowError(
      ExtractionBudgetExceededError,
    );
    try {
      budget.assertWithinBudget();
    } catch (error) {
      expect((error as ExtractionBudgetExceededError).reason).toBe("duration");
    }
  });

  it("throws once the token ceiling is crossed", () => {
    const budget = createDocumentBudget(
      { ...limits, maxCostUsdPerDocument: 1_000 },
      () => 0,
    );
    budget.recordUsage({ inputTokens: 80, outputTokens: 30 });

    expect(() => budget.assertWithinBudget()).toThrowError(/token budget/);
  });

  it("throws once the estimated cost ceiling is crossed", () => {
    const budget = createDocumentBudget(
      { ...limits, maxTokensPerDocument: 1_000_000 },
      () => 0,
    );
    // 100 tokens at 100 USD/M = 0.01 USD > 0.001 ceiling.
    budget.recordUsage({ inputTokens: 100 });

    expect(() => budget.assertWithinBudget()).toThrowError(/cost budget/);
  });

  it("tracks calls, retries, and cost in the snapshot", () => {
    const budget = createDocumentBudget(DEFAULT_EXTRACTION_LIMITS, () => 0);
    budget.recordUsage({ inputTokens: 1_000, outputTokens: 500 });
    budget.recordRetries(2);

    expect(budget.snapshot()).toMatchObject({
      calls: 1,
      retries: 2,
      inputTokens: 1_000,
      outputTokens: 500,
      totalTokens: 1_500,
    });
  });
});

describe("bounded AI retries", () => {
  it("enforces a per-call deadline via AbortSignal (provider timeout)", async () => {
    vi.useFakeTimers();
    try {
      const call = (signal: AbortSignal) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () =>
            reject(
              Object.assign(new Error("The operation timed out"), {
                name: "TimeoutError",
              }),
            ),
          );
        });

      const promise = callAIWithRetry(call, {
        maxRetries: 0,
        perCallTimeoutMs: 50,
      });
      const assertion = expect(promise).rejects.toThrow(/timed out/i);
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries retryable provider errors and then succeeds", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    let attempts = 0;
    const call = async () => {
      attempts += 1;
      if (attempts < 3) {
        throw apiError({ statusCode: 429, isRetryable: true });
      }
      return "ok";
    };

    const { result, retries } = await callAIWithRetry(call, {
      maxRetries: 4,
      perCallTimeoutMs: 1_000,
      sleep,
      random: () => 0.5,
    });

    expect(result).toBe("ok");
    expect(retries).toBe(2);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("uses bounded exponential backoff between retries", () => {
    const first = computeBackoffDelayMs({
      attempt: 0,
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      random: () => 1,
    });
    const second = computeBackoffDelayMs({
      attempt: 1,
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      random: () => 1,
    });
    const capped = computeBackoffDelayMs({
      attempt: 20,
      baseDelayMs: 1_000,
      maxDelayMs: 60_000,
      random: () => 1,
    });

    expect(first).toBe(1_000);
    expect(second).toBe(2_000);
    expect(capped).toBe(60_000);
  });

  it("respects provider Retry-After guidance as a floor", () => {
    const error = apiError({
      statusCode: 429,
      isRetryable: true,
      responseHeaders: { "retry-after": "30" },
    });

    expect(getRetryAfterMs(error)).toBe(30_000);
    expect(
      computeBackoffDelayMs({
        attempt: 0,
        baseDelayMs: 1_000,
        maxDelayMs: 60_000,
        retryAfterMs: 30_000,
        random: () => 0,
      }),
    ).toBeGreaterThanOrEqual(30_000);
  });

  it("throws RetryExhaustedError after the retry budget is spent", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const call = async () => {
      throw apiError({ statusCode: 503, isRetryable: true });
    };

    await expect(
      callAIWithRetry(call, {
        maxRetries: 2,
        perCallTimeoutMs: 1_000,
        sleep,
      }),
    ).rejects.toThrowError(RetryExhaustedError);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const call = async () => {
      throw apiError({ statusCode: 400, isRetryable: false });
    };

    await expect(
      callAIWithRetry(call, {
        maxRetries: 5,
        perCallTimeoutMs: 1_000,
        sleep,
      }),
    ).rejects.toThrowError(/provider error/);
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe("oversized documents", () => {
  it("flags documents above the character ceiling for rejection", () => {
    const limits = resolveExtractionLimits({
      limits: { maxDocumentChars: 100 },
    });
    const oversized = "a".repeat(101);

    expect(oversized.length > limits.maxDocumentChars).toBe(true);
  });
});
