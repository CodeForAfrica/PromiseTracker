import { loggerConfig } from '@promisetracker/cms/logger'
import { beforeSend, reportError, startSentry } from '@promisetracker/cms/sentry'
import { ConfigurationError, REDACTED, ValidationError } from '@promisetracker/kernel'
import { describe, expect, it, vi } from 'vitest'

describe("Payload's logger", () => {
  const { options } = loggerConfig({ NODE_ENV: 'production' })
  const logMethod = options.hooks?.logMethod
  const format = options.formatters?.log

  /** Runs a log call through the hook, and returns what pino would receive. */
  const call = (...args: unknown[]) => {
    const method = vi.fn()
    if (!logMethod) throw new Error('no logMethod hook')
    Reflect.apply(logMethod, {}, [args, method, 30])
    return method.mock.calls[0]
  }

  it('cleans the message of every call, Payload’s own included', () => {
    expect(call('Login failed for jane@example.org from 41.90.1.2')).toEqual([
      `Login failed for ${REDACTED} from ${REDACTED}`,
    ])
    expect(call({ id: 1 }, 'Sent to jane@example.org')).toEqual([{ id: 1 }, `Sent to ${REDACTED}`])
  })

  it("cleans an error's message when the error is logged on its own", () => {
    const error = new Error('No user jane@example.org')
    expect(call(error)).toEqual([{ err: error }, `No user ${REDACTED}`])
  })

  it('cleans the fields of every entry', () => {
    expect(format?.({ user: 'u1', email: 'a@b.org', err: new Error('at 10.0.0.1') })).toMatchObject(
      { user: 'u1', email: REDACTED, err: { message: `at ${REDACTED}` } },
    )
  })

  it('writes ISO times, and refuses a level that does not exist', () => {
    const timestamp = options.timestamp
    expect(typeof timestamp === 'function' ? timestamp() : '').toMatch(
      /^,"time":"\d{4}-\d\d-\d\dT[\d:.]+Z"$/,
    )
    expect(() => loggerConfig({ PT_LOG_LEVEL: 'loud' })).toThrow(ConfigurationError)
    expect(() => loggerConfig({ PT_LOG_LEVEL: 'loud' })).toThrow('PT_LOG_LEVEL must be one of')
  })

  it('keeps readable output in development, and JSON lines in production', () => {
    expect(loggerConfig({}).destination).toBeDefined()
    expect(loggerConfig({ NODE_ENV: 'production' }).destination).toBeUndefined()
  })
})

type ErrorEvent = Parameters<typeof beforeSend>[0]

describe('Sentry', () => {
  const event = (): ErrorEvent => ({
    type: undefined,
    message: 'Failed for jane@example.org',
    request: { headers: { cookie: 'payload-token=abc', 'user-agent': 'x' } },
    user: { ip_address: '41.90.1.2' },
    extra: { apiKey: 'k', note: 'from 10.0.0.1' },
  })

  it('is off when no Sentry address is set', async () => {
    await expect(startSentry({})).resolves.toBe(false)
    // Off, reporting does nothing and loads nothing.
    expect(() => reportError(new ConfigurationError('x'))).not.toThrow()
  })

  it('receives only errors a developer can fix', () => {
    expect(beforeSend(event(), { originalException: new ValidationError('x') })).toBeNull()
    expect(beforeSend(event(), { originalException: new ConfigurationError('x') })).not.toBeNull()
    expect(beforeSend(event(), { originalException: new TypeError('a bug') })).not.toBeNull()
  })

  it('never receives keys, tokens, passwords, email or network addresses', () => {
    const sent = beforeSend(event(), { originalException: new TypeError('a bug') })
    expect(sent).toMatchObject({
      message: `Failed for ${REDACTED}`,
      request: { headers: { cookie: REDACTED, 'user-agent': 'x' } },
      user: { ip_address: REDACTED },
      extra: { apiKey: REDACTED, note: `from ${REDACTED}` },
    })
  })
})
