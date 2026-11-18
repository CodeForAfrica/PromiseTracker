import { ConfigurationError, redact, redactText } from '@promisetracker/kernel'
import type { Config } from 'payload'
import { defaultLoggerOptions } from 'payload'

type LoggerConfig = Extract<NonNullable<Config['logger']>, { options: unknown }>
type LoggerOptions = LoggerConfig['options']
type LogMethodHook = NonNullable<NonNullable<LoggerOptions['hooks']>['logMethod']>

const LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])

/**
 * Cleans every log call before pino writes it, Payload's own included (section
 * 13.7). The message is cleaned here. The fields are cleaned by `formatters.log`.
 * An error passed on its own would have its raw message used as the log
 * message, so it becomes `{ err }` with a cleaned message.
 */
const redactCall: LogMethodHook = function (args, method) {
  const [first, ...rest] = args
  const cleaned: unknown[] =
    first instanceof Error
      ? [{ err: first }, redactText(typeof rest[0] === 'string' ? rest[0] : first.message)]
      : args.map((arg) => (typeof arg === 'string' ? redactText(arg) : arg))
  Reflect.apply(method, this, cleaned)
}

/**
 * Payload's logger, as structured entries (section 14): level, message, time,
 * and the source and record ids that `createLog` adds. Production writes one
 * JSON object per line. Development keeps Payload's readable output.
 */
export function loggerConfig(env: Readonly<Record<string, string | undefined>> = process.env) {
  const level = env.PT_LOG_LEVEL?.trim() || 'info'
  if (!LEVELS.has(level)) {
    throw new ConfigurationError(
      `PT_LOG_LEVEL must be one of ${[...LEVELS].join(', ')}, not "${level}".`,
    )
  }
  const options: LoggerOptions = {
    level,
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    formatters: { log: (entry) => redact(entry) as Record<string, unknown> },
    // `redact` has already turned errors into plain objects that keep their
    // type. pino's own serializer would rename them all "Object".
    serializers: { err: (value: unknown) => value },
    hooks: { logMethod: redactCall },
  }
  const config: LoggerConfig =
    env.NODE_ENV === 'production' ? { options } : { options, destination: defaultLoggerOptions }
  return config
}
