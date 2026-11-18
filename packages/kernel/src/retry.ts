import type { CircuitBreaker } from './circuit'
import type { RecordIds } from './errors'
import { ExternalServiceError, PromiseTrackerError } from './errors'
import type { SourceLog } from './log'

/** Section 9.7: the waits between attempts, and how long each kind of call may take. */
export const RETRY_LIMITS = Object.freeze({
  retries: 3,
  firstWaitMs: 1_000,
  maxWaitMs: 30_000,
})

export const TIMEOUTS = Object.freeze({
  fetchFile: 5 * 60_000,
  extractText: 2 * 60_000,
  aiCall: 2 * 60_000,
  aiStage: 20 * 60_000,
})

/** The wait before retry number `retry` (1-based): 1s, 2s, 4s, …, at most 30s. */
export function backoffMs(retry: number): number {
  return Math.min(RETRY_LIMITS.firstWaitMs * 2 ** (retry - 1), RETRY_LIMITS.maxWaitMs)
}

export type RetryDecision = { retry: true; waitMs: number } | { retry: false }

/**
 * Whether to try again after `error` on retry number `retry`, and how long to
 * wait. Only the error's `retryable` flag decides whether. An error that is not
 * one of ours is a bug, and a retry will not fix it.
 *
 * A service that asks for a wait gets it. A wait longer than 30 seconds is not
 * spent holding a worker: the error goes back to the queue with the wait on it.
 */
export function retryDecision(error: unknown, retry: number): RetryDecision {
  if (!(error instanceof PromiseTrackerError) || !error.retryable) return { retry: false }
  if (retry > RETRY_LIMITS.retries) return { retry: false }
  const asked = error instanceof ExternalServiceError ? error.retryAfterMs : undefined
  if (asked !== undefined && asked > RETRY_LIMITS.maxWaitMs) return { retry: false }
  return { retry: true, waitMs: asked ?? backoffMs(retry) }
}

export type RetryOptions = {
  /** The service or step, for errors and logs, for example `tika`. */
  service: string
  /** What the work is, for the logs, for example `fetch document`. */
  operation: string
  ids?: RecordIds
  /** Ends the work early, for example when the job is cancelled. Not retried. */
  signal?: AbortSignal
  /**
   * How long one attempt may take. See TIMEOUTS. An attempt still running at
   * the limit is abandoned, but only `fn` can stop its work: pass the signal
   * to its fetch or child process.
   */
  timeoutMs?: number
  breaker?: CircuitBreaker
  log?: SourceLog
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })

/** Settles with `work`, or rejects with the signal's reason if it fires first. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort = () => {}
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    // Raced either way, so a rejection from `work` is always handled.
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
  return Promise.race([work, aborted]).finally(() => signal.removeEventListener('abort', onAbort))
}

/**
 * Runs `fn`, retrying as section 9.7 says. Each attempt gets a signal that
 * fires on the caller's signal or the attempt's timeout, and an attempt that
 * runs out of time fails as a retryable timeout. With a breaker, every attempt
 * goes through it. Success and failure are both logged.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { service, operation, ids, signal, timeoutMs, breaker, log } = options
  const sleep = options.sleep ?? defaultSleep
  const logIds = ids ? { ids } : {}

  for (let attempt = 1; ; attempt++) {
    const timeout = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs)
    const attemptSignal = AbortSignal.any([signal, timeout].filter((s) => s !== undefined))
    const run = async (): Promise<T> => {
      try {
        return await untilAborted(fn(attemptSignal, attempt), attemptSignal)
      } catch (error) {
        // The attempt ran out of time. The caller's own cancel is passed on as it is.
        if (timeout?.aborted && !signal?.aborted) {
          throw ExternalServiceError.fromCause(service, timeout.reason, { ...logIds })
        }
        throw error
      }
    }
    try {
      const result = await (breaker ? breaker.call(run) : run())
      log?.info(`${operation} succeeded`, { ...logIds, service, attempts: attempt })
      return result
    } catch (error) {
      if (signal?.aborted) throw error
      const decision = retryDecision(error, attempt)
      if (!decision.retry) {
        log?.error(`${operation} failed`, { ...logIds, service, attempts: attempt, error })
        throw error
      }
      log?.warn(`${operation} failed, retrying`, {
        ...logIds,
        service,
        attempt,
        waitMs: decision.waitMs,
        error,
      })
      await sleep(decision.waitMs, signal)
    }
  }
}
