import type { SourceLog } from '@promisetracker/kernel'
import {
  backoffMs,
  CIRCUIT_DEFAULTS,
  CircuitBreaker,
  circuitBreakerFor,
  ExternalServiceError,
  ExtractionError,
  RETRY_LIMITS,
  resetCircuitBreakers,
  retryDecision,
  ValidationError,
  withRetry,
} from '@promisetracker/kernel'
import { describe, expect, it, vi } from 'vitest'

const outage = (failure: 'timeout' | 'unavailable' = 'unavailable') =>
  new ExternalServiceError('down', { service: 'tika', failure })

/** Records each wait instead of sleeping, so the tests run at once. */
const fakeSleep = () => {
  const waits: number[] = []
  const sleep = async (ms: number) => {
    waits.push(ms)
  }
  return { waits, sleep }
}

/** A log that records entries, to check what is logged. */
const memoryLog = () => {
  const entries: { level: string; message: string; fields: Record<string, unknown> }[] = []
  const at =
    (level: string) =>
    (message: string, fields: Record<string, unknown> = {}) =>
      entries.push({ level, message, fields })
  const log: SourceLog = { source: 'test', info: at('info'), warn: at('warn'), error: at('error') }
  return { entries, log }
}

/** Fails with each error in turn, then returns `ok`. */
const failing = (...errors: unknown[]) => {
  let calls = 0
  const fn = vi.fn(async () => {
    const error = errors[calls++]
    if (error !== undefined) throw error
    return 'ok'
  })
  return fn
}

describe('backoffMs', () => {
  it('starts at one second, doubles, and stops at 30 seconds (section 9.7)', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffMs)).toEqual([
      1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000,
    ])
  })
})

describe('retryDecision', () => {
  it('retries a timeout three times with growing waits', () => {
    const error = outage('timeout')
    expect([1, 2, 3, 4].map((n) => retryDecision(error, n))).toEqual([
      { retry: true, waitMs: 1_000 },
      { retry: true, waitMs: 2_000 },
      { retry: true, waitMs: 4_000 },
      { retry: false },
    ])
  })

  it('waits as long as a rate-limited service asks', () => {
    const error = new ExternalServiceError('slow down', {
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 7_000,
    })
    expect(retryDecision(error, 1)).toEqual({ retry: true, waitMs: 7_000 })
  })

  it('sends a long requested wait back to the queue instead of holding the worker', () => {
    const error = new ExternalServiceError('slow down', {
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 120_000,
    })
    expect(retryDecision(error, 1)).toEqual({ retry: false })
  })

  it('never retries invalid data, a rejected key, or an error that is not ours', () => {
    expect(retryDecision(new ValidationError('bad row'), 1)).toEqual({ retry: false })
    const unauthorized = new ExternalServiceError('no', {
      service: 'check',
      failure: 'unauthorized',
    })
    expect(retryDecision(unauthorized, 1)).toEqual({ retry: false })
    expect(retryDecision(new TypeError('a bug'), 1)).toEqual({ retry: false })
  })

  it('retries extraction within the same budget', () => {
    expect(retryDecision(new ExtractionError('unreadable'), 3)).toEqual({
      retry: true,
      waitMs: 4_000,
    })
    expect(retryDecision(new ExtractionError('unreadable'), 4)).toEqual({ retry: false })
  })
})

describe('withRetry', () => {
  const base = { service: 'tika', operation: 'extract text' }

  it('returns the first success, without waiting', async () => {
    const { waits, sleep } = fakeSleep()
    await expect(withRetry(async () => 'ok', { ...base, sleep })).resolves.toBe('ok')
    expect(waits).toEqual([])
  })

  it('retries a retryable failure and succeeds', async () => {
    const { waits, sleep } = fakeSleep()
    const fn = failing(outage(), outage())
    await expect(withRetry(fn, { ...base, sleep })).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(waits).toEqual([1_000, 2_000])
  })

  it('gives up after three retries and throws the last error', async () => {
    const { waits, sleep } = fakeSleep()
    const last = outage()
    const fn = failing(outage(), outage(), outage(), last)
    await expect(withRetry(fn, { ...base, sleep })).rejects.toBe(last)
    expect(fn).toHaveBeenCalledTimes(4)
    expect(waits).toEqual([1_000, 2_000, 4_000])
  })

  it('throws at once when the error says a retry cannot help', async () => {
    const { sleep } = fakeSleep()
    const invalid = new ValidationError('bad row')
    const fn = failing(invalid)
    await expect(withRetry(fn, { ...base, sleep })).rejects.toBe(invalid)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('turns an attempt that runs out of time into a retryable timeout', async () => {
    const { waits, sleep } = fakeSleep()
    let calls = 0
    const fn = (signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        if (calls++ > 0) {
          resolve('ok')
          return
        }
        signal.addEventListener('abort', () => reject(signal.reason))
      })
    await expect(withRetry(fn, { ...base, sleep, timeoutMs: 10 })).resolves.toBe('ok')
    expect(waits).toEqual([1_000])
  })

  it('abandons an attempt that ignores its signal when it runs out of time', async () => {
    const { waits, sleep } = fakeSleep()
    let calls = 0
    // The first attempt never settles and never looks at the signal.
    const fn = () => (calls++ > 0 ? Promise.resolve('ok') : new Promise<string>(() => {}))
    await expect(withRetry(fn, { ...base, sleep, timeoutMs: 10 })).resolves.toBe('ok')
    expect(waits).toEqual([1_000])
  })

  it('stops when the caller cancels, without retrying', async () => {
    const { sleep } = fakeSleep()
    const controller = new AbortController()
    const fn = vi.fn(async () => {
      controller.abort(new Error('job cancelled'))
      throw outage()
    })
    await expect(withRetry(fn, { ...base, sleep, signal: controller.signal })).rejects.toThrow(
      'down',
    )
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('logs successes as well as failures, with the record ids', async () => {
    const { sleep } = fakeSleep()
    const { entries, log } = memoryLog()
    const ids = { document: 'doc-1' }
    await withRetry(failing(outage()), { ...base, sleep, log, ids })
    await withRetry(failing(new ValidationError('bad')), { ...base, sleep, log, ids }).catch(
      () => {},
    )
    expect(entries.map((e) => [e.level, e.message])).toEqual([
      ['warn', 'extract text failed, retrying'],
      ['info', 'extract text succeeded'],
      ['error', 'extract text failed'],
    ])
    expect(entries.every((e) => e.fields.ids === ids)).toBe(true)
    expect(entries[1]?.fields).toMatchObject({ service: 'tika', attempts: 2 })
  })

  it('really waits between attempts, and a cancel ends the wait', async () => {
    const quick = new ExternalServiceError('slow down', {
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 5,
    })
    await expect(withRetry(failing(quick), base)).resolves.toBe('ok')

    const controller = new AbortController()
    const long = new ExternalServiceError('slow down', {
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 20_000,
    })
    const pending = withRetry(failing(long), { ...base, signal: controller.signal })
    // Cancel during the 20-second wait.
    setTimeout(() => controller.abort(new Error('job cancelled')), 10)
    await expect(pending).rejects.toThrow('job cancelled')
  })

  it('goes through a circuit breaker, and stops retrying while it is open', async () => {
    const { waits, sleep } = fakeSleep()
    const breaker = new CircuitBreaker({ service: 'tika', failureThreshold: 2 })
    const fn = vi.fn(async () => {
      throw outage()
    })
    const error = await withRetry(fn, { ...base, sleep, breaker }).catch((e: unknown) => e)
    // Two outages open the breaker. The third attempt is refused with a 60-second
    // wait, which is longer than a worker holds, so the job goes back to the queue.
    expect(fn).toHaveBeenCalledTimes(2)
    expect(waits).toEqual([1_000, 2_000])
    expect(error).toBeInstanceOf(ExternalServiceError)
    expect(error).toMatchObject({ failure: 'circuit-open', retryable: true })
  })
})

describe('CircuitBreaker', () => {
  const clock = () => {
    let time = 0
    return { now: () => time, advance: (ms: number) => (time += ms) }
  }
  const fail = (breaker: CircuitBreaker, error: unknown = outage()) =>
    breaker.call(async () => Promise.reject(error)).catch(() => {})
  const pass = (breaker: CircuitBreaker) => breaker.call(async () => 'ok')

  it('opens after 5 failures in a row (section 9.7)', async () => {
    const breaker = new CircuitBreaker({ service: 'tika' })
    for (let i = 0; i < 4; i++) await fail(breaker)
    expect(breaker.state).toBe('closed')
    await fail(breaker)
    expect(breaker.state).toBe('open')
  })

  it('counts only failures in a row', async () => {
    const breaker = new CircuitBreaker({ service: 'tika' })
    for (let i = 0; i < 4; i++) await fail(breaker)
    await pass(breaker)
    for (let i = 0; i < 4; i++) await fail(breaker)
    expect(breaker.state).toBe('closed')
  })

  it('refuses calls for 60 seconds without calling the service', async () => {
    const time = clock()
    const breaker = new CircuitBreaker({ service: 'tika', now: time.now })
    for (let i = 0; i < 5; i++) await fail(breaker)
    time.advance(20_000)
    const fn = vi.fn(async () => 'ok')
    const error = await breaker.call(fn).catch((e: unknown) => e)
    expect(fn).not.toHaveBeenCalled()
    expect(error).toMatchObject({
      code: 'external.circuit-open',
      service: 'tika',
      retryable: true,
      retryAfterMs: 40_000,
    })
  })

  it('resumes after 3 test requests pass', async () => {
    const time = clock()
    const breaker = new CircuitBreaker({ service: 'tika', now: time.now })
    for (let i = 0; i < 5; i++) await fail(breaker)
    time.advance(60_000)
    expect(breaker.state).toBe('half-open')
    await pass(breaker)
    await pass(breaker)
    expect(breaker.state).toBe('half-open')
    await pass(breaker)
    expect(breaker.state).toBe('closed')
  })

  it('opens again for 60 seconds when a test request fails', async () => {
    const time = clock()
    const breaker = new CircuitBreaker({ service: 'tika', now: time.now })
    for (let i = 0; i < 5; i++) await fail(breaker)
    time.advance(60_000)
    await pass(breaker)
    await fail(breaker)
    expect(breaker.state).toBe('open')
    time.advance(59_999)
    expect(breaker.state).toBe('open')
    time.advance(1)
    expect(breaker.state).toBe('half-open')
  })

  it('runs one test request at a time', async () => {
    const time = clock()
    const breaker = new CircuitBreaker({ service: 'tika', now: time.now })
    for (let i = 0; i < 5; i++) await fail(breaker)
    time.advance(60_000)
    let release = () => {}
    const slow = breaker.call(
      () => new Promise<string>((resolve) => (release = () => resolve('ok'))),
    )
    await expect(pass(breaker)).rejects.toMatchObject({ failure: 'circuit-open' })
    release()
    await expect(slow).resolves.toBe('ok')
  })

  it('is not tripped by errors that are not outages', async () => {
    const breaker = new CircuitBreaker({ service: 'check' })
    const unauthorized = new ExternalServiceError('no', {
      service: 'check',
      failure: 'unauthorized',
    })
    for (let i = 0; i < 10; i++) await fail(breaker, unauthorized)
    for (let i = 0; i < 10; i++) await fail(breaker, new ValidationError('bad'))
    expect(breaker.state).toBe('closed')
  })

  it('backs off normally while another caller is testing the service', async () => {
    const time = clock()
    const breaker = new CircuitBreaker({ service: 'tika', now: time.now })
    for (let i = 0; i < 5; i++) await fail(breaker)
    time.advance(60_000)
    let release = () => {}
    const probe = breaker.call(
      () => new Promise<string>((resolve) => (release = () => resolve('ok'))),
    )
    const rejection = await pass(breaker).catch((e: unknown) => e)
    expect(rejection).toMatchObject({ failure: 'circuit-open', retryAfterMs: undefined })
    // Without a wait from the breaker, the caller waits 1s, 2s, 4s rather than 0.
    expect(retryDecision(rejection, 1)).toEqual({ retry: true, waitMs: 1_000 })
    release()
    await probe
  })

  it('keeps one breaker per service in a process, until reset', () => {
    const tika = circuitBreakerFor('tika')
    expect(circuitBreakerFor('tika')).toBe(tika)
    expect(circuitBreakerFor('tika')).not.toBe(circuitBreakerFor('check'))
    resetCircuitBreakers()
    expect(circuitBreakerFor('tika')).not.toBe(tika)
  })

  it('keeps RETRY_LIMITS and the breaker defaults in step with the specification', () => {
    expect(RETRY_LIMITS).toEqual({ retries: 3, firstWaitMs: 1_000, maxWaitMs: 30_000 })
    expect(CIRCUIT_DEFAULTS).toEqual({ failureThreshold: 5, openMs: 60_000, probes: 3 })
  })
})
