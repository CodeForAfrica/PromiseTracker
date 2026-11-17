import type { RecordIds } from './errors'
import { PromiseTrackerError } from './errors'
import type { Logger } from './ports'

/**
 * Section 13.7: logs and error reports never contain keys, tokens, passwords,
 * email addresses or network addresses. `redact` removes them from anything
 * about to be logged or sent to Sentry.
 */
export const REDACTED = '[redacted]'

// Fields whose value is a secret or personal, whatever it looks like.
const SENSITIVE_KEY =
  /pass(word|phrase)?|secret|token|api[-_]?key|private[-_]?key|access[-_]?key|authori[sz]ation|cookie|credential|session|signature|e-?mail|^ip$|ip[-_]?addr|remote[-_]?addr|x-forwarded-for|x-real-ip/i

const PATTERNS: readonly [RegExp, string][] = [
  // user:password@ in a URL.
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, `$1${REDACTED}@`],
  // Secrets passed in a query string.
  [/([?&](?:[a-z_-]*(?:token|key|secret|password|signature|sig))=)[^&\s#]+/gi, `$1${REDACTED}`],
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/g, `$1 ${REDACTED}`],
  // Email addresses.
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // IPv4 addresses.
  [/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, REDACTED],
  // IPv6 addresses: all eight groups, or a `::`. Clock times have neither.
  [
    /(?<![\w:])(?:(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?::(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*)?)(?![\w:])/gi,
    REDACTED,
  ],
]

export function redactText(text: string): string {
  return PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text)
}

/**
 * A copy of `value` with secrets and personal data removed: sensitive fields
 * by name, and addresses and tokens inside any text. Errors become plain
 * objects with their message and stack cleaned.
 */
export function redact(value: unknown): unknown {
  return redactValue(value, new WeakSet())
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen))
  if (value instanceof Date) return value
  if (value instanceof Error) return redactError(value, seen)
  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(inner, seen)
  }
  return out
}

function redactError(error: Error, seen: WeakSet<object>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: error.name,
    message: redactText(error.message),
    ...(error.stack ? { stack: redactText(error.stack) } : {}),
  }
  if (error instanceof PromiseTrackerError) {
    out.code = error.code
    out.ids = error.ids
    out.retryable = error.retryable
  }
  if (error.cause !== undefined) out.cause = redactValue(error.cause, seen)
  return out
}

export type LogFields = {
  /** The records involved, so one document can be followed through the pipeline. */
  ids?: RecordIds
  error?: unknown
  [field: string]: unknown
}

/** A log that names where each entry comes from. */
export type SourceLog = {
  readonly source: string
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
}

/**
 * Wraps Payload's logger, which adds the level and time, so every entry also
 * carries its source and the record ids (section 14). An error's own ids join
 * the entry's.
 */
export function createLog(logger: Logger, source: string): SourceLog {
  const write =
    (level: 'info' | 'warn' | 'error') =>
    (message: string, fields: LogFields = {}): void => {
      const { error, ids, ...rest } = fields
      const errorIds = error instanceof PromiseTrackerError ? error.ids : {}
      const allIds = { ...errorIds, ...ids }
      const entry = redact({
        source,
        ...(Object.keys(allIds).length > 0 ? { ids: allIds } : {}),
        ...(error === undefined ? {} : { err: error }),
        ...rest,
      })
      logger[level](entry, redactText(message))
    }
  return { source, info: write('info'), warn: write('warn'), error: write('error') }
}
