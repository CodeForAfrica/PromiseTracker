import { APICallError } from "ai";

export class RetryExhaustedError extends Error {
  readonly attempts: number;
  readonly lastError: unknown;

  constructor(attempts: number, lastError: unknown) {
    const lastMessage =
      lastError instanceof Error ? lastError.message : String(lastError);
    super(`AI call failed after ${attempts} attempt(s): ${lastMessage}`);
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export type RetryOptions = {
  /** Retry attempts after the initial call. */
  maxRetries: number;
  /** Hard deadline per attempt (ms); enforced via AbortSignal. */
  perCallTimeoutMs: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. */
  random?: () => number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    /abort|timed? ?out/i.test(error.message));

export const isRetryableAIError = (error: unknown): boolean => {
  if (isAbortError(error)) {
    return true;
  }
  if (APICallError.isInstance(error)) {
    if (typeof error.isRetryable === "boolean") {
      return error.isRetryable;
    }
    const status = error.statusCode ?? 0;
    return status === 429 || status >= 500;
  }
  return false;
};

/**
 * Reads provider rate-limit guidance (Retry-After / retry-after-ms headers)
 * from an APICallError. Returns a delay in ms, or undefined when absent.
 */
export const getRetryAfterMs = (error: unknown): number | undefined => {
  if (!APICallError.isInstance(error)) {
    return undefined;
  }
  const headers = error.responseHeaders ?? {};
  const lookup = (name: string) =>
    headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];

  const retryAfterMs = Number(lookup("retry-after-ms"));
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return retryAfterMs;
  }

  const retryAfter = lookup("retry-after");
  if (retryAfter === undefined) {
    return undefined;
  }
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1_000;
  }
  const dateMs = Date.parse(String(retryAfter));
  if (!Number.isNaN(dateMs)) {
    const delay = dateMs - Date.now();
    return delay > 0 ? delay : undefined;
  }
  return undefined;
};

export const computeBackoffDelayMs = ({
  attempt,
  baseDelayMs,
  maxDelayMs,
  retryAfterMs,
  random = Math.random,
}: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryAfterMs?: number;
  random?: () => number;
}): number => {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  // Full jitter keeps concurrent retries from thundering-herding a provider.
  const jittered = exponential / 2 + random() * (exponential / 2);
  // Provider rate-limit guidance is a floor, never shortened by jitter.
  const withGuidance = Math.max(jittered, retryAfterMs ?? 0);
  return Math.min(Math.round(withGuidance), Math.max(maxDelayMs, retryAfterMs ?? 0));
};

/**
 * Runs an AI call with a per-attempt deadline and bounded exponential
 * backoff. The callback receives an AbortSignal it MUST pass to the provider
 * call. Non-retryable errors are rethrown immediately; retryable errors are
 * retried up to `maxRetries` times, then wrapped in RetryExhaustedError.
 */
export const callAIWithRetry = async <T>(
  fn: (signal: AbortSignal) => Promise<T>,
  {
    maxRetries,
    perCallTimeoutMs,
    baseDelayMs = 1_000,
    maxDelayMs = 60_000,
    onRetry,
    sleep = defaultSleep,
    random = Math.random,
  }: RetryOptions,
): Promise<{ result: T; retries: number }> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await fn(AbortSignal.timeout(perCallTimeoutMs));
      return { result, retries: attempt };
    } catch (error) {
      lastError = error;

      if (!isRetryableAIError(error) || attempt === maxRetries) {
        break;
      }

      const delayMs = computeBackoffDelayMs({
        attempt,
        baseDelayMs,
        maxDelayMs,
        retryAfterMs: getRetryAfterMs(error),
        random,
      });
      onRetry?.({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
    }
  }

  if (isRetryableAIError(lastError)) {
    throw new RetryExhaustedError(maxRetries + 1, lastError);
  }
  throw lastError;
};
