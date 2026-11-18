import { describe, expect, it } from 'vitest'

import { assertTestDatabase, testDatabaseUrl, UnsafeTestDatabaseError } from '../database'

describe('testDatabaseUrl', () => {
  it('names a database per suite beside the development one', () => {
    const env = { DATABASE_URL: 'postgres://u:p@localhost:55432/promisetracker?sslmode=disable' }
    expect(testDatabaseUrl('int', env)).toBe(
      'postgres://u:p@localhost:55432/promisetracker_int_test?sslmode=disable',
    )
    expect(testDatabaseUrl('e2e', env)).toBe(
      'postgres://u:p@localhost:55432/promisetracker_e2e_test?sslmode=disable',
    )
  })

  it('follows the Compose settings when DATABASE_URL is not set', () => {
    expect(testDatabaseUrl('int', { PT_POSTGRES_PORT: '55432' })).toBe(
      'postgres://promisetracker:promisetracker@localhost:55432/promisetracker_int_test',
    )
  })

  it('keeps a URL that already names the suite database, so child processes agree', () => {
    const url = 'postgres://u:p@localhost:5432/promisetracker_int_test'
    expect(testDatabaseUrl('int', { DATABASE_URL: url })).toBe(url)
  })
})

describe('assertTestDatabase', () => {
  it('accepts a local database named for tests', () => {
    expect(assertTestDatabase('postgres://u:p@localhost:5432/promisetracker_int_test')).toBe(
      'promisetracker_int_test',
    )
    expect(assertTestDatabase('postgres://u:p@127.0.0.1/x_e2e_test')).toBe('x_e2e_test')
    expect(assertTestDatabase('postgres://u:p@[::1]:5432/x_test')).toBe('x_test')
    expect(assertTestDatabase('postgres://u:p@postgres:5432/x_test')).toBe('x_test')
  })

  it('refuses the development database', () => {
    expect(() => assertTestDatabase('postgres://u:p@localhost:5432/promisetracker')).toThrow(
      UnsafeTestDatabaseError,
    )
  })

  it('refuses a database on another machine, even one named for tests', () => {
    expect(() => assertTestDatabase('postgres://u:p@db.example.org:5432/pt_int_test')).toThrow(
      /not one on db\.example\.org/,
    )
    expect(() => assertTestDatabase('postgres://u:p@10.0.0.5/pt_int_test')).toThrow(
      UnsafeTestDatabaseError,
    )
  })

  it('refuses names that could break out of the quoted identifier', () => {
    expect(() => assertTestDatabase('postgres://u:p@localhost/a%22%3B%20drop_test')).toThrow(
      UnsafeTestDatabaseError,
    )
  })

  it('refuses a missing or malformed URL', () => {
    expect(() => assertTestDatabase(undefined)).toThrow(UnsafeTestDatabaseError)
    expect(() => assertTestDatabase('not a url')).toThrow(UnsafeTestDatabaseError)
    expect(() => assertTestDatabase('postgres://u:p@localhost:5432/')).toThrow(
      UnsafeTestDatabaseError,
    )
  })
})
