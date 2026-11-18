import type { CountryCode } from '@promisetracker/plugin-core'
import type { Payload } from 'payload'

/**
 * Countries the tests may use: small ones a newsroom is unlikely to track, so
 * the tests can share a development database without touching real records.
 */
const POOL: readonly CountryCode[] = ['st', 'km', 'sc', 'cv', 'gw', 'sz', 'ls', 'dj']

/** `count` codes from the pool that no country in the database uses yet. */
export async function unusedCountryCodes(payload: Payload, count: number): Promise<CountryCode[]> {
  const { docs } = await payload.find({
    collection: 'countries',
    where: { code: { in: [...POOL] } },
    pagination: false,
    depth: 0,
    // Test set-up reads as the system.
    overrideAccess: true,
  })
  const taken = new Set(docs.map((d) => d.code))
  const free = POOL.filter((code) => !taken.has(code))
  if (free.length < count) {
    throw new Error(`The tests need ${count} unused countries from ${POOL.join(', ')}.`)
  }
  return free.slice(0, count)
}
