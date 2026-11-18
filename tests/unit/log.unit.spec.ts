import {
  createLog,
  ExternalServiceError,
  REDACTED,
  redact,
  redactText,
  ValidationError,
} from '@promisetracker/kernel'
import { describe, expect, it, vi } from 'vitest'

describe('redactText (section 13.7)', () => {
  it.each([
    ['email addresses', 'Sent to jane.doe+news@example.co.ke today', `Sent to ${REDACTED} today`],
    ['IPv4 addresses', 'from 41.90.12.7 via 10.0.0.1', `from ${REDACTED} via ${REDACTED}`],
    [
      'IPv6 addresses',
      'client 2001:db8::8a2e:370:7334 and ::1',
      `client ${REDACTED} and ${REDACTED}`,
    ],
    [
      'bearer tokens',
      'Authorization: Bearer eyJhbGciOi.abc-123',
      `Authorization: Bearer ${REDACTED}`,
    ],
    [
      'credentials in a URL',
      'postgres://user:hunter2@db:5432/pt',
      `postgres://${REDACTED}@db:5432/pt`,
    ],
    [
      'secrets in a query string',
      'GET /hook?id=4&api_key=abc123&token=xyz',
      `GET /hook?id=4&api_key=${REDACTED}&token=${REDACTED}`,
    ],
  ])('removes %s', (_, input, output) => {
    expect(redactText(input)).toBe(output)
  })

  it('leaves times, versions, ids and plain text alone', () => {
    const text =
      'At 10:52:27 payload 4.0.0-beta.9 read document 3f2a1c9e-8b7d-4e6f-9a0b-1c2d3e4f5a6b'
    expect(redactText(text)).toBe(text)
  })
})

describe('redact', () => {
  it('removes sensitive fields by name, at any depth', () => {
    expect(
      redact({
        user: { id: 'u1', email: 'a@b.org', password: 'pw' },
        headers: { authorization: 'Basic abc', cookie: 'payload-token=x', 'x-forwarded-for': '1' },
        settings: { apiKey: 'k', webhookSecret: 's', accessToken: 't', count: 3 },
        list: ['ok', 'mail me at a@b.org'],
      }),
    ).toEqual({
      user: { id: 'u1', email: REDACTED, password: REDACTED },
      headers: { authorization: REDACTED, cookie: REDACTED, 'x-forwarded-for': REDACTED },
      settings: { apiKey: REDACTED, webhookSecret: REDACTED, accessToken: REDACTED, count: 3 },
      list: ['ok', `mail me at ${REDACTED}`],
    })
  })

  it('matches field names by whole words, so counts are kept', () => {
    expect(
      redact({
        inputTokens: 120,
        maxTokens: 4000,
        bypass: true,
        author: 'Desk',
        refresh_token: 'r',
        'x-api-key': 'k',
        'x-real-ip': '1',
        remoteAddress: '1',
        sessionId: 's',
      }),
    ).toEqual({
      inputTokens: 120,
      maxTokens: 4000,
      bypass: true,
      author: 'Desk',
      refresh_token: REDACTED,
      'x-api-key': REDACTED,
      'x-real-ip': REDACTED,
      remoteAddress: REDACTED,
      sessionId: REDACTED,
    })
  })

  it('keeps the service, failure and wait of an outside service error', () => {
    const error = new ExternalServiceError('slow down', {
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 5_000,
    })
    expect(redact(error)).toMatchObject({
      code: 'external.rate-limited',
      service: 'check',
      failure: 'rate-limited',
      retryAfterMs: 5_000,
    })
  })

  it('cleans an error and keeps its code, ids and cause', () => {
    const cause = new Error('connect ECONNREFUSED 10.1.2.3:5432')
    const error = new ValidationError('No user a@b.org', {
      ids: { document: 'd1' },
      cause,
    })
    expect(redact(error)).toMatchObject({
      type: 'ValidationError',
      message: `No user ${REDACTED}`,
      code: 'validation',
      ids: { document: 'd1' },
      retryable: false,
      cause: { type: 'Error', message: `connect ECONNREFUSED ${REDACTED}:5432` },
    })
  })

  it('does not loop on circular values or change the input', () => {
    const value: Record<string, unknown> = { email: 'a@b.org' }
    value.self = value
    expect(redact(value)).toEqual({ email: REDACTED, self: '[circular]' })
    expect(value.email).toBe('a@b.org')
  })
})

describe('createLog (section 14)', () => {
  const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })

  it('adds the source and record ids, and cleans the entry', () => {
    const base = logger()
    const log = createLog(base, 'pipeline')
    log.info('Fetched for jane@example.org', { ids: { document: 'd1' }, bytes: 120 })
    expect(base.info).toHaveBeenCalledWith(
      { source: 'pipeline', ids: { document: 'd1' }, bytes: 120 },
      `Fetched for ${REDACTED}`,
    )
  })

  it("joins an error's own ids to the entry's", () => {
    const base = logger()
    const log = createLog(base, 'pipeline')
    const error = new ValidationError('bad', { ids: { document: 'd1' } })
    log.error('Import failed', { error, ids: { import: 'i1' } })
    const [entry] = base.error.mock.calls[0] ?? []
    expect(entry).toMatchObject({
      source: 'pipeline',
      ids: { document: 'd1', import: 'i1' },
      err: { type: 'ValidationError', code: 'validation' },
    })
  })
})
