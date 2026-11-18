import { createLocalTransport, getPayload } from '@promisetracker/cms'
import { createSdk } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SEED_COUNTRIES, seedCountry } from '../../seed/seed'

/**
 * The seed data loads into an empty database, loads again without changing
 * anything, and gives the site real pages (seed/README.md). Integration tests
 * run on their own database (tests/database.ts), and this one removes only
 * the seed countries it added.
 */
describe('seed data', () => {
  let payload: Payload
  const sdk = createSdk(createLocalTransport())

  const seedCountries = async () =>
    (
      await payload.find({
        collection: 'countries',
        where: { code: { in: [...SEED_COUNTRIES] } },
        overrideAccess: true,
      })
    ).docs

  beforeAll(async () => {
    payload = await getPayload()
    // The test database starts without them, so everything below is this test's to remove.
    expect(await seedCountries()).toEqual([])
  })

  afterAll(async () => {
    for (const { id } of await seedCountries()) {
      for (const collection of ['terms', 'actors', 'areas', 'offices'] as const) {
        await payload.delete({
          collection,
          where: { country: { equals: id } },
          overrideAccess: true,
        })
      }
      await payload.delete({ collection: 'countries', id, overrideAccess: true })
    }
  })

  it.each(SEED_COUNTRIES)('loads %s, and changes nothing the second time', async (code) => {
    const first = await seedCountry(payload, code)
    for (const counts of Object.values(first)) {
      expect(counts).toMatchObject({ update: 0, skip: 0, failed: 0 })
    }
    const again = await seedCountry(payload, code)
    for (const counts of Object.values(again)) {
      expect(counts).toMatchObject({ create: 0, update: 0, failed: 0 })
    }
  })

  it('gives Kenya its presidency and a governor in every county', async () => {
    expect(await sdk.getRedirect('en', '/ke/president')).toEqual({
      to: '/ke/e/william-ruto',
      permanent: false,
    })
    const governors = await sdk.getActors('en', 'ke', { stage: 'current', office: 'governor' })
    expect(governors.total).toBe(47)
    expect(await sdk.getActor('en', 'ke', 'uhuru-kenyatta')).toMatchObject({
      stage: 'past',
      terms: [{ successor: { slug: 'william-ruto' } }, { successor: null }],
    })
    expect(await sdk.getActor('en', 'ke', 'william-ruto')).toMatchObject({
      stage: 'current',
      seats: [{ office: { slug: 'president' } }],
    })
  })

  it('gives Senegal its president, in French', async () => {
    expect(await sdk.getSeat('fr', 'sn', 'president')).toMatchObject({
      office: { name: 'Président de la République' },
      holders: [{ slug: 'bassirou-diomaye-faye' }],
    })
    expect((await sdk.getAreas('fr', 'sn', 'senegal')).total).toBe(14)
  })
})
