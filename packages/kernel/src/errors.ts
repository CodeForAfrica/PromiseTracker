/**
 * The error types in section 14 of the system specification. Every error
 * carries a stable code, the ids of the records involved, and whether a retry
 * can help. Retry logic reads `retryable` and nothing else.
 *
 * A code is `<type>` or `<type>.<detail>`, for example `external.rate-limited`.
 * Codes are part of the logs and of what editors see, so they do not change.
 */

/** Record ids by record type, for example `{ document: '…' }`. Never personal data. */
export type RecordIds = Readonly<Record<string, string>>

/** Who can fix it. Only `developer` problems go to Sentry (section 14). */
export type Audience = 'developer' | 'editor' | 'none'

export type ErrorOptions = {
  code?: string
  ids?: RecordIds
  cause?: unknown
}

export abstract class PromiseTrackerError extends Error {
  readonly code: string
  readonly ids: RecordIds
  abstract readonly retryable: boolean
  abstract readonly audience: Audience

  constructor(message: string, defaultCode: string, options: ErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.code = options.code ?? defaultCode
    this.ids = Object.freeze({ ...options.ids })
  }
}

/** A setting is missing or wrong at start-up. The system does not start. */
export class ConfigurationError extends PromiseTrackerError {
  override name = 'ConfigurationError'
  readonly retryable = false
  readonly audience = 'developer'
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'configuration', options)
  }
}

/** A port has no adapter, or more than one. The system does not start. */
export class PortResolutionError extends PromiseTrackerError {
  override name = 'PortResolutionError'
  readonly retryable = false
  readonly audience = 'developer'
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'port-resolution', options)
  }
}

/**
 * Why an outside service failed. Each reason has one row in the table in
 * section 9.7.
 */
export type ExternalFailure =
  | 'timeout'
  | 'rate-limited'
  | 'unavailable'
  | 'circuit-open'
  | 'invalid-response'
  | 'unauthorized'

const RETRYABLE_FAILURES: ReadonlySet<ExternalFailure> = new Set([
  'timeout',
  'rate-limited',
  'unavailable',
  'circuit-open',
])

export type ExternalServiceErrorOptions = ErrorOptions & {
  /** The outside service, for example `check` or `tika`. Also the circuit breaker's key. */
  service: string
  failure: ExternalFailure
  /** How long the service asked us to wait, from a `Retry-After` header. */
  retryAfterMs?: number
}

/** An outside service fails or times out. Whether to retry depends on why. */
export class ExternalServiceError extends PromiseTrackerError {
  override name = 'ExternalServiceError'
  readonly service: string
  readonly failure: ExternalFailure
  readonly retryAfterMs: number | undefined
  readonly retryable: boolean
  readonly audience: Audience

  constructor(message: string, options: ExternalServiceErrorOptions) {
    super(message, `external.${options.failure}`, options)
    this.service = options.service
    this.failure = options.failure
    this.retryAfterMs = options.retryAfterMs
    this.retryable = RETRYABLE_FAILURES.has(options.failure)
    // A rejected key or a changed API needs a developer. The rest pass on their own.
    this.audience =
      options.failure === 'unauthorized' || options.failure === 'invalid-response'
        ? 'developer'
        : 'none'
  }

  /** The error for an HTTP response that was not OK. */
  static fromResponse(
    service: string,
    response: Pick<Response, 'status' | 'headers'>,
    options: ErrorOptions = {},
  ): ExternalServiceError {
    const { status } = response
    const failure: ExternalFailure =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 408
          ? 'timeout'
          : status === 429
            ? 'rate-limited'
            : status >= 500
              ? 'unavailable'
              : 'invalid-response'
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
    return new ExternalServiceError(`${service} answered HTTP ${status}.`, {
      ...options,
      service,
      failure,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    })
  }

  /**
   * The error for a call that threw before a response: a timeout, a refused
   * connection or a dropped one. All of these can pass, so all are retried.
   */
  static fromCause(service: string, cause: unknown, options: ErrorOptions = {}) {
    if (cause instanceof ExternalServiceError) return cause
    const name = cause instanceof Error ? cause.name : ''
    const failure: ExternalFailure =
      name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unavailable'
    return new ExternalServiceError(
      failure === 'timeout'
        ? `${service} did not answer in time.`
        : `${service} could not be reached.`,
      { ...options, service, failure, cause },
    )
  }
}

/** Reading a file or running AI fails. Retried within the retry budget. */
export class ExtractionError extends PromiseTrackerError {
  override name = 'ExtractionError'
  readonly retryable = true
  // A file that cannot be read shows on the document in the admin.
  readonly audience = 'editor'
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'extraction', options)
  }
}

/** Data has the wrong shape, or a claim fails a publishing check. */
export class ValidationError extends PromiseTrackerError {
  override name = 'ValidationError'
  readonly retryable = false
  readonly audience = 'editor'
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'validation', options)
  }
}

/** Something writes a field a plugin owns. */
export class OwnershipError extends PromiseTrackerError {
  override name = 'OwnershipError'
  readonly retryable = false
  readonly audience = 'developer'
  constructor(message: string, options?: ErrorOptions) {
    super(message, 'ownership', options)
  }
}

/**
 * Whether Sentry should hear about it: problems only a developer can fix.
 * Payload's own errors carry an HTTP status, and one below 500, such as a
 * wrong password or a missing record, is the client's. Anything else that is
 * not one of ours is a bug, so it counts.
 */
export function isDeveloperError(error: unknown): boolean {
  if (error instanceof PromiseTrackerError) return error.audience === 'developer'
  const status = typeof error === 'object' && error !== null ? Reflect.get(error, 'status') : null
  return !(typeof status === 'number' && status < 500)
}

/** A `Retry-After` header in milliseconds: seconds, or an HTTP date (RFC 9110). */
export function parseRetryAfter(header: string | null, now = Date.now()): number | undefined {
  if (!header) return undefined
  const trimmed = header.trim()
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000
  const date = Date.parse(trimmed)
  return Number.isNaN(date) ? undefined : Math.max(0, date - now)
}
