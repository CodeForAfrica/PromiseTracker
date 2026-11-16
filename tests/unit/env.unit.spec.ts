import { assertRuntimeEnv, databaseUrl } from '@promisetracker/cms/env'
import { describe, expect, it } from 'vitest'

describe('databaseUrl', () => {
  it('uses DATABASE_URL when set', () => {
    expect(databaseUrl({ DATABASE_URL: 'postgres://a:b@db:5432/x' })).toBe(
      'postgres://a:b@db:5432/x',
    )
  })

  it('builds a local URL from the Compose settings outside production', () => {
    expect(databaseUrl({ PT_POSTGRES_PORT: '55432' })).toBe(
      'postgres://promisetracker:promisetracker@localhost:55432/promisetracker',
    )
  })

  it('has no default in production', () => {
    expect(databaseUrl({ NODE_ENV: 'production' })).toBe('')
  })
})

describe('assertRuntimeEnv', () => {
  it('names every missing production setting', () => {
    expect(() => assertRuntimeEnv({ NODE_ENV: 'production' })).toThrow(
      'Missing settings: PAYLOAD_SECRET, DATABASE_URL.',
    )
  })

  it('needs only the secret outside production', () => {
    expect(() => assertRuntimeEnv({ PAYLOAD_SECRET: 'x' })).not.toThrow()
    expect(() => assertRuntimeEnv({})).toThrow('Missing settings: PAYLOAD_SECRET.')
  })
})
