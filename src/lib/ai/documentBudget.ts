import type { ExtractionLimits } from "./extractionLimits";

export type BudgetExceededReason = "duration" | "tokens" | "cost";

export class ExtractionBudgetExceededError extends Error {
  readonly reason: BudgetExceededReason;

  constructor(reason: BudgetExceededReason, message: string) {
    super(message);
    this.name = "ExtractionBudgetExceededError";
    this.reason = reason;
  }
}

export type AIUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

/**
 * Tracks per-document AI spend (wall-clock time, tokens, estimated cost)
 * against the configured ceilings. Call `assertWithinBudget()` before every
 * AI call and `recordUsage()` after; once any ceiling is crossed the document
 * fails fast instead of continuing to accrue provider cost.
 */
export const createDocumentBudget = (
  limits: ExtractionLimits,
  now: () => number = Date.now,
) => {
  const startedAt = now();
  let inputTokens = 0;
  let outputTokens = 0;
  let calls = 0;
  let retries = 0;

  const totalTokens = () => inputTokens + outputTokens;
  const costUsd = () =>
    (inputTokens / 1_000_000) * limits.inputCostUsdPerMillionTokens +
    (outputTokens / 1_000_000) * limits.outputCostUsdPerMillionTokens;
  const elapsedMs = () => now() - startedAt;

  const assertWithinBudget = () => {
    if (elapsedMs() > limits.maxDocumentDurationMs) {
      throw new ExtractionBudgetExceededError(
        "duration",
        `Document exceeded its total AI duration budget (${limits.maxDocumentDurationMs}ms).`,
      );
    }
    if (totalTokens() > limits.maxTokensPerDocument) {
      throw new ExtractionBudgetExceededError(
        "tokens",
        `Document exceeded its token budget (${limits.maxTokensPerDocument} tokens).`,
      );
    }
    if (costUsd() > limits.maxCostUsdPerDocument) {
      throw new ExtractionBudgetExceededError(
        "cost",
        `Document exceeded its cost budget (USD ${limits.maxCostUsdPerDocument}).`,
      );
    }
  };

  const recordUsage = (usage?: AIUsage | null) => {
    calls += 1;
    if (!usage) {
      return;
    }
    const input = usage.inputTokens ?? 0;
    const output = usage.outputTokens ?? 0;
    if (input || output) {
      inputTokens += input;
      outputTokens += output;
    } else if (usage.totalTokens) {
      // Providers that only report a total; attribute it to input pricing.
      inputTokens += usage.totalTokens;
    }
  };

  const recordRetries = (count: number) => {
    retries += count;
  };

  return {
    assertWithinBudget,
    recordUsage,
    recordRetries,
    snapshot: () => ({
      elapsedMs: elapsedMs(),
      inputTokens,
      outputTokens,
      totalTokens: totalTokens(),
      costUsd: Number(costUsd().toFixed(6)),
      calls,
      retries,
    }),
  };
};

export type DocumentBudget = ReturnType<typeof createDocumentBudget>;
