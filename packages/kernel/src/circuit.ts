import { ExternalServiceError } from './errors'

export type CircuitState = 'closed' | 'open' | 'half-open'

export type CircuitBreakerOptions = {
  /** The outside service. Shown in errors and logs. */
  service: string
  /** Failures in a row that stop calls. */
  failureThreshold?: number
  /** How long calls stay stopped. */
  openMs?: number
  /** Test requests that must pass before calls resume. */
  probes?: number
  now?: () => number
}

/** Section 9.7: after 5 failures in a row, stop for 60 seconds, then test with 3 requests. */
export const CIRCUIT_DEFAULTS = Object.freeze({ failureThreshold: 5, openMs: 60_000, probes: 3 })

/**
 * Only a failure that says the service itself is in trouble counts. A rejected
 * key or a bad request would fail every time, and is not a sign of an outage.
 */
const isOutage = (error: unknown): boolean =>
  error instanceof ExternalServiceError &&
  (error.failure === 'timeout' ||
    error.failure === 'unavailable' ||
    error.failure === 'rate-limited')

/**
 * Stops calls to an outside service that keeps failing, so a down service is
 * not hammered and jobs fail fast while it recovers.
 *
 * Closed, calls go through. After `failureThreshold` outages in a row it
 * opens, and calls fail at once with a retryable `circuit-open` error. After
 * `openMs` it is half-open: up to `probes` calls run as tests, one at a time.
 * When all pass it closes. When one fails it opens again.
 */
export class CircuitBreaker {
  readonly service: string
  readonly #threshold: number
  readonly #openMs: number
  readonly #probes: number
  readonly #now: () => number
  #failures = 0
  #openedAt: number | null = null
  #probesPassed = 0
  #probing = false

  constructor(options: CircuitBreakerOptions) {
    this.service = options.service
    this.#threshold = options.failureThreshold ?? CIRCUIT_DEFAULTS.failureThreshold
    this.#openMs = options.openMs ?? CIRCUIT_DEFAULTS.openMs
    this.#probes = options.probes ?? CIRCUIT_DEFAULTS.probes
    this.#now = options.now ?? Date.now
  }

  get state(): CircuitState {
    if (this.#openedAt === null) return 'closed'
    return this.#now() - this.#openedAt < this.#openMs ? 'open' : 'half-open'
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state
    if (state === 'open' || (state === 'half-open' && this.#probing)) throw this.#rejection()
    const probe = state === 'half-open'
    if (probe) this.#probing = true
    try {
      const result = await fn()
      this.#succeeded(probe)
      return result
    } catch (error) {
      this.#failed(probe, error)
      throw error
    } finally {
      if (probe) this.#probing = false
    }
  }

  #succeeded(probe: boolean): void {
    this.#failures = 0
    if (!probe) return
    this.#probesPassed += 1
    if (this.#probesPassed >= this.#probes) {
      this.#openedAt = null
      this.#probesPassed = 0
    }
  }

  #failed(probe: boolean, error: unknown): void {
    if (!isOutage(error)) {
      // Not an outage, but a probe that did not pass leaves the service untested.
      if (probe) this.#probesPassed = 0
      return
    }
    this.#failures += 1
    if (probe || this.#failures >= this.#threshold) {
      this.#openedAt = this.#now()
      this.#probesPassed = 0
      this.#failures = 0
    }
  }

  #rejection(): ExternalServiceError {
    const openedAt = this.#openedAt ?? this.#now()
    const retryAfterMs = openedAt + this.#openMs - this.#now()
    // Half-open with a test request running, the pause is over but there is no
    // time to give. Leaving the wait out lets the caller use its normal backoff
    // rather than retrying at once.
    return new ExternalServiceError(
      `Calls to ${this.service} are paused after repeated failures.`,
      {
        service: this.service,
        failure: 'circuit-open',
        ...(retryAfterMs > 0 ? { retryAfterMs } : {}),
      },
    )
  }
}

const breakers = new Map<string, CircuitBreaker>()

/**
 * The one breaker for a service in this process. Version 1 runs one web
 * process (section 16.1), and each worker keeps its own count.
 */
export function circuitBreakerFor(service: string): CircuitBreaker {
  let breaker = breakers.get(service)
  if (!breaker) {
    breaker = new CircuitBreaker({ service })
    breakers.set(service, breaker)
  }
  return breaker
}

/** Forgets every breaker, so tests that use `circuitBreakerFor` start from closed. */
export function resetCircuitBreakers(): void {
  breakers.clear()
}
