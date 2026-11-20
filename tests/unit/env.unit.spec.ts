import { assertRuntimeEnv, databaseUrl, publicUrl } from '@promisetracker/cms/env'
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

describe('publicUrl', () => {
  it('is the address without a trailing slash', () => {
    expect(publicUrl({ PT_PUBLIC_URL: 'https://promisetracker.example.org/' })).toBe(
      'https://promisetracker.example.org',
    )
    expect(publicUrl({ PT_PUBLIC_URL: ' https://example.org/pt// ' })).toBe(
      'https://example.org/pt',
    )
  })

  it('is empty when unset or not a web address', () => {
    for (const value of [undefined, '', 'not a url', 'ftp://example.org']) {
      expect(publicUrl({ PT_PUBLIC_URL: value })).toBe('')
    }
  })
})
