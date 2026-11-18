import {
  ConfigurationError,
  ExternalServiceError,
  ExtractionError,
  isDeveloperError,
  OwnershipError,
  PortResolutionError,
  PromiseTrackerError,
  parseRetryAfter,
  ValidationError,
} from '@promisetracker/kernel'
import { describe, expect, it } from 'vitest'

const response = (status: number, retryAfter?: string) => ({
  status,
  headers: new Headers(retryAfter ? { 'retry-after': retryAfter } : {}),
})

describe('the error types in section 14', () => {
  it('each carries a stable code, the record ids and whether a retry can help', () => {
    const ids = { document: 'doc-1' }
    const errors = [
      [new ConfigurationError('x', { ids }), 'configuration', false],
      [new PortResolutionError('x', { ids }), 'port-resolution', false],
      [new ExtractionError('x', { ids }), 'extraction', true],
      [new ValidationError('x', { ids }), 'validation', false],
      [new OwnershipError('x', { ids }), 'ownership', false],
      [
        new ExternalServiceError('x', { ids, service: 'tika', failure: 'timeout' }),
        'external.timeout',
        true,
      ],
    ] as const
    for (const [error, code, retryable] of errors) {
      expect(error).toBeInstanceOf(PromiseTrackerError)
      expect(error).toBeInstanceOf(Error)
      expect({ name: error.name, code: error.code, retryable: error.retryable }).toEqual({
        name: error.constructor.name,
        code,
        retryable,
      })
      expect(error.ids).toEqual(ids)
    }
  })

  it('takes a more specific code and keeps the cause', () => {
    const cause = new Error('inner')
    const error = new ValidationError('Row 4 names an unknown actor.', {
      code: 'validation.unknown-actor',
      cause,
    })
    expect(error.code).toBe('validation.unknown-actor')
    expect(error.cause).toBe(cause)
  })
})

describe('ExternalServiceError', () => {
  it('reads the HTTP status the way the table in section 9.7 does', () => {
    const at = (status: number) => ExternalServiceError.fromResponse('check', response(status))
    expect(at(408)).toMatchObject({ failure: 'timeout', retryable: true })
    expect(at(429)).toMatchObject({ failure: 'rate-limited', retryable: true })
    expect(at(503)).toMatchObject({ failure: 'unavailable', retryable: true })
    expect(at(500)).toMatchObject({ failure: 'unavailable', retryable: true })
    expect(at(400)).toMatchObject({ failure: 'invalid-response', retryable: false })
    expect(at(401)).toMatchObject({ failure: 'unauthorized', retryable: false })
    expect(at(403)).toMatchObject({ code: 'external.unauthorized', service: 'check' })
  })

  it('keeps the wait a rate-limited service asks for', () => {
    expect(ExternalServiceError.fromResponse('check', response(429, '12')).retryAfterMs).toBe(
      12_000,
    )
  })

  it('treats a call that threw before answering as a timeout or an outage', () => {
    const timeout = new DOMException('timed out', 'TimeoutError')
    expect(ExternalServiceError.fromCause('tika', timeout)).toMatchObject({
      failure: 'timeout',
      retryable: true,
      cause: timeout,
    })
    expect(ExternalServiceError.fromCause('tika', new TypeError('fetch failed'))).toMatchObject({
      failure: 'unavailable',
      retryable: true,
    })
    const existing = new ExternalServiceError('x', { service: 'tika', failure: 'unauthorized' })
    expect(ExternalServiceError.fromCause('tika', existing)).toBe(existing)
  })
})

describe('parseRetryAfter', () => {
  it('reads seconds or an HTTP date', () => {
    expect(parseRetryAfter('3')).toBe(3_000)
    const now = Date.parse('2026-11-17T10:00:00Z')
    expect(parseRetryAfter('Tue, 17 Nov 2026 10:00:30 GMT', now)).toBe(30_000)
    expect(parseRetryAfter('Tue, 17 Nov 2026 09:00:00 GMT', now)).toBe(0)
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('soon')).toBeUndefined()
  })
})

describe('isDeveloperError', () => {
  it('sends only what a developer must fix', () => {
    expect(isDeveloperError(new ConfigurationError('x'))).toBe(true)
    expect(isDeveloperError(new PortResolutionError('x'))).toBe(true)
    expect(isDeveloperError(new OwnershipError('x'))).toBe(true)
    const unauthorized = new ExternalServiceError('x', {
      service: 'check',
      failure: 'unauthorized',
    })
    expect(isDeveloperError(unauthorized)).toBe(true)
    // A bug.
    expect(isDeveloperError(new TypeError('undefined is not a function'))).toBe(true)
  })

  it('keeps out what an editor can fix, what passes on its own, and client mistakes', () => {
    expect(isDeveloperError(new ValidationError('x'))).toBe(false)
    expect(isDeveloperError(new ExtractionError('x'))).toBe(false)
    const outage = new ExternalServiceError('x', { service: 'tika', failure: 'unavailable' })
    expect(isDeveloperError(outage)).toBe(false)
    // Payload's errors for a wrong password or a missing record.
    expect(isDeveloperError(Object.assign(new Error('Unauthorized'), { status: 401 }))).toBe(false)
    expect(isDeveloperError(Object.assign(new Error('Not Found'), { status: 404 }))).toBe(false)
    expect(isDeveloperError(Object.assign(new Error('Broken'), { status: 500 }))).toBe(true)
  })
})
