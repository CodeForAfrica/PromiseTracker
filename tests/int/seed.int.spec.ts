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
    for (const counts of Object.values(first.counts)) {
      expect(counts).toMatchObject({ update: 0, skip: 0, failed: 0 })
    }
    expect(first.notes).toEqual([])
    const again = await seedCountry(payload, code)
    for (const counts of Object.values(again.counts)) {
      expect(counts).toMatchObject({ create: 0, update: 0, failed: 0 })
    }
  })

  it('leaves an actor an editor held on hold, and says when a country is held', async () => {
    const { docs } = await payload.find({
      collection: 'actors',
      where: { slug: { equals: 'johnson-sakaja' } },
      overrideAccess: true,
    })
    const [sakaja] = docs
    if (!sakaja) throw new Error('The seed has no Johnson Sakaja')
    await payload.update({
      collection: 'actors',
      id: sakaja.id,
      data: { recordStatus: 'hold' },
      overrideAccess: true,
    })
    const { docs: countries } = await payload.find({
      collection: 'countries',
      where: { code: { equals: 'ke' } },
      overrideAccess: true,
    })
    const ke = countries[0]?.id ?? ''
    await payload.update({
      collection: 'countries',
      id: ke,
      data: { recordStatus: 'hold' },
      overrideAccess: true,
    })
    const again = await seedCountry(payload, 'ke')
    expect(again.notes).toEqual([expect.stringContaining('set to hold')])
    const after = await payload.findByID({
      collection: 'actors',
      id: sakaja.id,
      overrideAccess: true,
    })
    expect(after.recordStatus).toBe('hold')
    await payload.update({
      collection: 'actors',
      id: sakaja.id,
      data: { recordStatus: 'ready' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'countries',
      id: ke,
      data: { recordStatus: 'ready' },
      overrideAccess: true,
    })
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
    // Kenyan places have Swahili names too. The tests do not switch Swahili on,
    // so the name is read from the record rather than the site.
    const nairobi = await payload.find({
      collection: 'areas',
      where: { slug: { equals: 'nairobi-county' } },
      locale: 'sw',
      overrideAccess: true,
    })
    expect(nairobi.docs[0]?.name).toBe('Kaunti ya Nairobi')
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
