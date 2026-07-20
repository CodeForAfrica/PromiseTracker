/**
 * Operational ceilings for AI extraction runs. Every AI call gets a per-call
 * deadline, and each document has total duration, character, chunk, token,
 * retry, and cost ceilings. Values can be overridden per-deployment from the
 * Settings → Generative AI → Extraction Limits group; anything unset falls
 * back to these defaults.
 */
export type ExtractionLimits = {
  /** Hard deadline for a single AI provider call (ms). */
  perCallTimeoutMs: number;
  /** Total wall-clock budget for all AI work on one document (ms). */
  maxDocumentDurationMs: number;
  /** Maximum extracted-text size accepted for AI analysis (characters). */
  maxDocumentChars: number;
  /** Maximum number of chunks processed per document. */
  maxChunksPerDocument: number;
  /** Total token budget (input + output) per document. */
  maxTokensPerDocument: number;
  /** Maximum retry attempts per AI call (after the initial attempt). */
  maxRetriesPerCall: number;
  /** Total provider cost budget per document (USD). */
  maxCostUsdPerDocument: number;
  /** Estimated input-token price used for cost accounting (USD per 1M). */
  inputCostUsdPerMillionTokens: number;
  /** Estimated output-token price used for cost accounting (USD per 1M). */
  outputCostUsdPerMillionTokens: number;
  /** Base delay for exponential backoff between retries (ms). */
  retryBaseDelayMs: number;
  /** Ceiling for a single backoff delay (ms). */
  retryMaxDelayMs: number;
};

export const DEFAULT_EXTRACTION_LIMITS: ExtractionLimits = {
  perCallTimeoutMs: 120_000,
  maxDocumentDurationMs: 20 * 60_000,
  maxDocumentChars: 1_500_000,
  maxChunksPerDocument: 120,
  maxTokensPerDocument: 2_000_000,
  maxRetriesPerCall: 4,
  maxCostUsdPerDocument: 10,
  inputCostUsdPerMillionTokens: 3,
  outputCostUsdPerMillionTokens: 15,
  retryBaseDelayMs: 1_000,
  retryMaxDelayMs: 60_000,
};

type LimitsInput = Partial<Record<keyof ExtractionLimits, unknown>>;

const positiveNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
};

export const resolveExtractionLimits = (
  aiSettings?: { limits?: LimitsInput | null } | null,
): ExtractionLimits => {
  const overrides = aiSettings?.limits ?? {};

  return (
    Object.keys(DEFAULT_EXTRACTION_LIMITS) as (keyof ExtractionLimits)[]
  ).reduce<ExtractionLimits>(
    (limits, key) => {
      const override = positiveNumber(overrides[key]);
      if (override !== undefined) {
        limits[key] = override;
      }
      return limits;
    },
    { ...DEFAULT_EXTRACTION_LIMITS },
  );
};
