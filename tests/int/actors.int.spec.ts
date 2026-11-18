import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createLocalTransport, getPayload, handleV1 } from '@promisetracker/cms'
import type { CountryCode, ImportTarget } from '@promisetracker/plugin-core'
import { csvImporter, guessMapping, runImportPlan } from '@promisetracker/plugin-core'
import { createSdk } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Actors, terms, seat addresses and the officials list (sections 7.3, 10.3,
 * 11.2 and 12.1), with fictional office holders in a small country no one
 * tracks.
 */
describe('actors and terms', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  const sdk = createSdk(createLocalTransport())

  const read = async (name: string) => {
    const data = readFileSync(path.resolve(import.meta.dirname, '../fixtures', name))
    const content = { filename: name, mimeType: 'text/csv', data: new Uint8Array(data) }
    const { headings } = await csvImporter.inspect(content, {} as never)
    const rows = []
    for await (const row of csvImporter.rows(content, {} as never)) rows.push(row)
    return { headings, rows }
  }
  const load = async (target: ImportTarget, name: string, commit = true) => {
    const { headings, rows } = await read(name)
    const mapping =
      target === 'areas'
        ? { name: 'Name', type: 'Type', parent: 'Parent' }
        : guessMapping(target, headings)
    return runImportPlan(payload, { target, country, headings, rows, mapping, commit })
  }
  const idOf = async (collection: 'actors' | 'areas' | 'offices', slug: string) =>
    (
      await payload.find({
        collection,
        where: { and: [{ country: { equals: country } }, { slug: { equals: slug } }] },
        overrideAccess: true,
      })
    ).docs[0]?.id ?? ''
  const v1 = (route: string, query: Record<string, string> = {}) =>
    handleV1(payload, route, new URLSearchParams({ locale: 'en', ...query }))

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'sc'] = await unusedCountryCodes(payload, 1)
    // Test set-up writes as the system.
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    for (const [target, name] of [
      ['offices', 'kenya-offices.csv'],
      ['areas', 'kenya-areas.csv'],
    ] as const) {
      const { errors } = await load(target, name)
      expect(errors).toEqual([])
    }
  })

  afterAll(async () => {
    for (const collection of ['terms', 'actors', 'areas', 'offices', 'imports'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
      })
    }
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
  })

  describe('importing actors and terms', () => {
    it('previews actors, then imports them', async () => {
      const preview = await load('actors', 'kenya-actors.csv', false)
      expect(preview.counts).toEqual({ create: 10, update: 0, skip: 0, failed: 0 })
      expect(await idOf('actors', 'achieng-wekesa')).toBe('')
      const result = await load('actors', 'kenya-actors.csv')
      expect(result).toEqual({ counts: { create: 10, update: 0, skip: 0, failed: 0 }, errors: [] })
      const amani = await payload.find({
        collection: 'actors',
        where: { slug: { equals: 'amani-otieno' }, country: { equals: country } },
        locale: 'fr',
        overrideAccess: true,
      })
      expect(amani.docs[0]).toMatchObject({
        kind: 'person',
        honorific: 'H.E.',
        biography: 'Un président fictif pour les tests.',
        recordStatus: 'hold',
      })
    })

    it('imports terms, naming offices and areas by name or slug', async () => {
      const result = await load('terms', 'kenya-terms.csv')
      expect(result).toEqual({ counts: { create: 8, update: 0, skip: 0, failed: 0 }, errors: [] })
      // Editors release actors by hand. The tests release them all at once.
      await payload.update({
        collection: 'actors',
        where: { country: { equals: country } },
        data: { recordStatus: 'ready' },
        overrideAccess: true,
      })
    })

    it('skips terms that have not changed when the file is imported again', async () => {
      const again = await load('terms', 'kenya-terms.csv', false)
      expect(again.counts).toEqual({ create: 0, update: 0, skip: 8, failed: 0 })
    })

    it('reports a term that names an actor or seat that does not fit', async () => {
      const result = await runImportPlan(payload, {
        target: 'terms',
        country,
        commit: false,
        headings: ['Actor', 'Office', 'Area', 'Party', 'Starts on'],
        rows: [
          { row: 1, values: ['Nobody Known', 'Governor', 'Nairobi County', '', '2022-08-25'] },
          { row: 2, values: ['Juma Hassan', 'Governor', 'Westlands', '', '2022-08-25'] },
          { row: 3, values: ['Juma Hassan', 'President', 'Kenya', '', '2022-08-25'] },
          { row: 4, values: ['Juma Hassan', 'MP', 'Westlands', 'Halima Yusuf', '2022-02-30'] },
        ],
        mapping: {
          actor: 'Actor',
          office: 'Office',
          area: 'Area',
          party: 'Party',
          startsOn: 'Starts on',
        },
      })
      expect(result.counts.failed).toBe(4)
      expect(result.errors.map((e) => e.message)).toEqual([
        'Actor "nobody-known" is not in this country. Import the actors first.',
        'This office answers for a county.',
        'This office answers for the whole country, so leave the area empty.',
        'Starts on "2022-02-30" is not a date written as YYYY-MM-DD. The party must be a party.',
      ])
    })
  })

  describe('rules', () => {
    it('keeps slugs unique in a country across every kind of actor', async () => {
      await expect(
        payload.create({
          collection: 'actors',
          data: { name: 'Umoja Party', kind: 'institution', country, recordStatus: 'hold' },
          overrideAccess: true,
        }),
      ).rejects.toThrow('already uses "umoja-party"')
    })

    it('refuses a term whose area is not the kind its office answers for', async () => {
      await expect(
        payload.create({
          collection: 'terms',
          data: {
            actor: await idOf('actors', 'juma-hassan'),
            office: await idOf('offices', 'governor'),
            area: await idOf('areas', 'westlands'),
            startsOn: '2022-08-25T00:00:00.000Z',
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow('answers for a county')
    })

    it('says what to choose when a term names a record that does not exist', async () => {
      await expect(
        payload.create({
          collection: 'terms',
          data: {
            actor: '00000000-0000-4000-8000-000000000000',
            office: await idOf('offices', 'president'),
            startsOn: '2022-08-25T12:00:00.000Z',
          },
          overrideAccess: true,
        }),
      ).rejects.toMatchObject({ status: 400, message: 'Choose the actor who holds this term.' })
    })

    it('fits no more holders in a seat than its office allows, and allows a handover day', async () => {
      const seat = {
        office: await idOf('offices', 'governor'),
        area: await idOf('areas', 'nairobi-county'),
      }
      await expect(
        payload.create({
          collection: 'terms',
          data: {
            ...seat,
            actor: await idOf('actors', 'juma-hassan'),
            startsOn: '2024-01-01T12:00:00.000Z',
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow('This seat takes one holder at a time')
      // Ends the day the current governor started: a handover, not an overlap.
      const before = await payload.create({
        collection: 'terms',
        data: {
          ...seat,
          actor: await idOf('actors', 'juma-hassan'),
          startsOn: '2013-03-27T12:00:00.000Z',
          endsOn: '2017-08-21T12:00:00.000Z',
        },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'terms', id: before.id, overrideAccess: true })
    })

    it('keeps an actor’s first day in step with their terms, without a version of the actor', async () => {
      const actor = await idOf('actors', 'juma-hassan')
      const versions = async () =>
        (
          await payload.countVersions({
            collection: 'actors',
            where: { parent: { equals: actor } },
            overrideAccess: true,
          })
        ).totalDocs
      const count = await versions()
      const early = await payload.create({
        collection: 'terms',
        data: {
          actor,
          office: await idOf('offices', 'mp'),
          area: await idOf('areas', 'kibra'),
          startsOn: '2013-03-27T12:00:00.000Z',
          endsOn: '2017-08-21T12:00:00.000Z',
        },
        overrideAccess: true,
      })
      const doc = await payload.findByID({ collection: 'actors', id: actor, overrideAccess: true })
      expect(doc.onRecordSince?.slice(0, 10)).toBe('2013-03-27')
      expect(await versions()).toBe(count)
      await payload.delete({ collection: 'terms', id: early.id, overrideAccess: true })
      const after = await payload.findByID({
        collection: 'actors',
        id: actor,
        overrideAccess: true,
      })
      expect(after.onRecordSince?.slice(0, 10)).toBe('2022-09-08')
    })

    it('works out each term’s stage from its dates', async () => {
      const terms = await payload.find({
        collection: 'terms',
        where: { country: { equals: country } },
        pagination: false,
        overrideAccess: true,
      })
      const stages = Object.fromEntries(terms.docs.map((t) => [t.title?.split(',')[0], t.stage]))
      expect(stages).toMatchObject({
        'Achieng Wekesa': 'current',
        'Baraka Njoroge': 'past',
        'Kito Barasa': 'candidate',
      })
    })

    it('lets a guest read no candidate, through any route', async () => {
      // As Payload's REST routes read: a guest, with access rules on.
      const actors = await payload.find({
        collection: 'actors',
        where: { country: { equals: country } },
        pagination: false,
        overrideAccess: false,
      })
      const names = actors.docs.map((a) => a.slug)
      expect(names).toContain('achieng-wekesa')
      expect(names).not.toContain('kito-barasa')
      const terms = await payload.find({
        collection: 'terms',
        where: { country: { equals: country } },
        pagination: false,
        overrideAccess: false,
      })
      expect(terms.docs).toHaveLength(7)
      expect(terms.docs.map((t) => t.title)).not.toContain(
        'Kito Barasa, Member of Parliament (2030)',
      )
    })

    it('lists an actor’s terms and an office’s holders for staff, and never for guests', async () => {
      const id = await idOf('actors', 'achieng-wekesa')
      // A signed-in user with access rules on, as the admin reads.
      const staff = { id: 'staff', collection: 'users', roles: ['viewer'] } as never
      const seen = await payload.findByID({
        collection: 'actors',
        id,
        overrideAccess: false,
        user: staff,
      })
      expect(seen.terms?.docs).toHaveLength(1)
      const office = await payload.findByID({
        collection: 'offices',
        id: await idOf('offices', 'governor'),
        overrideAccess: false,
        user: staff,
      })
      expect(office.terms?.docs).toHaveLength(3)
      const place = await payload.findByID({
        collection: 'countries',
        id: country,
        overrideAccess: false,
        user: staff,
      })
      // The first page of the country's 71 areas, with more to page through.
      expect(place.areas?.docs).toHaveLength(10)
      expect(place.areas?.hasNextPage).toBe(true)
      const nairobi = await payload.findByID({
        collection: 'areas',
        id: await idOf('areas', 'nairobi-county'),
        overrideAccess: false,
        user: staff,
      })
      expect(nairobi.children?.docs).toHaveLength(10)
      expect(nairobi.terms?.docs).toHaveLength(4)
      const guest = await payload.findByID({ collection: 'actors', id, overrideAccess: false })
      expect(guest.terms).toBeUndefined()
    })

    it('renames the terms in the admin’s lists when an actor or office is renamed', async () => {
      const office = await idOf('offices', 'senator')
      await payload.update({
        collection: 'offices',
        id: office,
        locale: 'en',
        data: { name: 'County Senator' },
        overrideAccess: true,
      })
      const { docs } = await payload.find({
        collection: 'terms',
        where: { office: { equals: office } },
        overrideAccess: true,
      })
      expect(docs.map((t) => t.title)).toEqual(['Halima Yusuf, County Senator (2022)'])
      await payload.update({
        collection: 'offices',
        id: office,
        locale: 'en',
        data: { name: 'Senator' },
        overrideAccess: true,
      })
    })

    it('refuses to delete an area or office that a term names', async () => {
      await expect(
        payload.delete({
          collection: 'areas',
          id: await idOf('areas', 'westlands'),
          overrideAccess: true,
        }),
      ).rejects.toThrow('Terms name this area')
      await expect(
        payload.delete({
          collection: 'offices',
          id: await idOf('offices', 'president'),
          overrideAccess: true,
        }),
      ).rejects.toThrow('Terms name this office')
    })

    it('keeps a renamed actor’s old slug, and leads the old address to the new one', async () => {
      const id = await idOf('actors', 'zawadi-mutua')
      await payload.update({
        collection: 'actors',
        id,
        data: { slug: 'zawadi-m-mutua' },
        overrideAccess: true,
      })
      const doc = await payload.findByID({ collection: 'actors', id, overrideAccess: true })
      expect(doc.formerSlugs).toEqual(['zawadi-mutua'])
      expect(await sdk.getRedirect('en', `/${code}/e/zawadi-mutua`)).toEqual({
        to: `/${code}/e/zawadi-m-mutua`,
        permanent: true,
      })
    })
  })

  describe('the API (section 12.1)', () => {
    it('never shows an actor whose only term has not started', async () => {
      expect((await v1(`/countries/${code}/actors/kito-barasa`))?.status).toBe(404)
      const { items } = await sdk.getActors('en', code, { kind: 'person' })
      expect(items.map((a) => a.slug)).not.toContain('kito-barasa')
    })

    it('returns a current holder, with their terms and party', async () => {
      const actor = await sdk.getActor('en', code, 'achieng-wekesa')
      expect(actor).toMatchObject({
        name: 'Achieng Wekesa',
        stage: 'current',
        party: { slug: 'umoja-party', name: 'Umoja Party', kind: 'party' },
        seats: [{ office: { slug: 'governor' }, area: { slug: 'nairobi-county' } }],
        terms: [{ stage: 'current', startsOn: '2022-08-25', endsOn: null }],
      })
    })

    it('returns a past holder as an archived record, with the closing summary and successor', async () => {
      const fr = await sdk.getActor('fr', code, 'baraka-njoroge')
      expect(fr).toMatchObject({
        stage: 'past',
        seats: [],
        terms: [
          {
            stage: 'past',
            endsOn: '2022-08-25',
            closingSummary: expect.stringContaining('Deux des cinq'),
            successor: { slug: 'achieng-wekesa' },
          },
        ],
      })
    })

    it('lists current officials, filtered and sorted', async () => {
      const all = await sdk.getActors('en', code, { stage: 'current', sort: 'office' })
      expect(all.items.map((a) => a.slug)).toEqual([
        'amani-otieno',
        'achieng-wekesa',
        'zawadi-m-mutua',
        'halima-yusuf',
        'wanjiru-kamau',
        'juma-hassan',
      ])
      const governors = await sdk.getActors('en', code, { stage: 'current', office: 'governor' })
      expect(governors.items.map((a) => a.slug).sort()).toEqual([
        'achieng-wekesa',
        'zawadi-m-mutua',
      ])
      const nairobi = await sdk.getActors('en', code, {
        stage: 'current',
        area: 'nairobi-county',
        party: 'mwangaza-alliance',
      })
      expect(nairobi.items.map((a) => a.slug)).toEqual(['halima-yusuf'])
      const page = await sdk.getActors('en', code, { stage: 'current', sort: 'name', limit: 4 })
      expect(page).toMatchObject({ total: 6, nextCursor: '4' })
      expect((await v1(`/countries/${code}/actors`, { sort: 'kept' }))?.status).toBe(400)
    })

    it('lists those who held office before', async () => {
      const past = await sdk.getActors('en', code, { stage: 'past' })
      expect(past.items.map((a) => [a.slug, a.stage])).toEqual([['baraka-njoroge', 'past']])
    })

    it('returns a seat’s holders, and a national seat’s', async () => {
      expect(await sdk.getSeat('en', code, 'governor', 'nairobi-county')).toMatchObject({
        office: { slug: 'governor' },
        area: { slug: 'nairobi-county' },
        holders: [{ slug: 'achieng-wekesa', party: { slug: 'umoja-party' } }],
      })
      expect(await sdk.getSeat('en', code, 'president')).toMatchObject({
        area: null,
        holders: [{ slug: 'amani-otieno' }],
      })
      // A county office is not a national seat, and a seat must match its area's kind.
      expect((await v1(`/countries/${code}/seats/governor`))?.status).toBe(404)
      expect((await v1(`/countries/${code}/seats/westlands/governor`))?.status).toBe(404)
    })

    it('adds each seat’s holders to an area', async () => {
      const area = await sdk.getArea('en', code, 'nairobi-county')
      expect(area).toMatchObject({
        seats: [
          { office: { slug: 'governor' }, holders: [{ slug: 'achieng-wekesa' }] },
          { office: { slug: 'senator' }, holders: [{ slug: 'halima-yusuf' }] },
          { office: { slug: 'woman-representative' }, holders: [{ slug: 'wanjiru-kamau' }] },
        ],
      })
      // A candidate does not hold the seat yet.
      expect(await sdk.getArea('en', code, 'kibra')).toMatchObject({ seats: [{ holders: [] }] })
    })

    it('leads a seat, and an area with one seat, to the holder for now (section 11.2)', async () => {
      const to = (slug: string) => ({ to: `/${code}/e/${slug}`, permanent: false })
      expect(await sdk.getRedirect('en', `/${code}/nairobi-county/governor`)).toEqual(
        to('achieng-wekesa'),
      )
      expect(await sdk.getRedirect('en', `/${code}/president`)).toEqual(to('amani-otieno'))
      expect(await sdk.getRedirect('en', `/${code}/westlands`)).toEqual(to('juma-hassan'))
      // Several seats, or a seat with no holder, lead nowhere.
      expect(await sdk.getRedirect('en', `/${code}/nairobi-county`)).toBeNull()
      expect(await sdk.getRedirect('en', `/${code}/kibra`)).toBeNull()
    })

    it('leads a renamed area to its new address, permanently', async () => {
      const id = await idOf('areas', 'mvita')
      await payload.update({
        collection: 'areas',
        id,
        data: { slug: 'mvita-constituency' },
        overrideAccess: true,
      })
      expect(await sdk.getRedirect('en', `/${code}/mvita`)).toEqual({
        to: `/${code}/mvita-constituency`,
        permanent: true,
      })
      expect(await sdk.getRedirect('en', `/${code}/mvita/mp`)).toEqual({
        to: `/${code}/mvita-constituency/mp`,
        permanent: true,
      })
    })

    it('counts what the country page’s sections need (section 10.3)', async () => {
      const country = await sdk.getCountry('en', code)
      expect(country).toMatchObject({ counts: { currentHolders: 6, pastTerms: 1 } })
    })

    it('hides an actor set to hold, and their seat', async () => {
      const id = await idOf('actors', 'juma-hassan')
      await payload.update({
        collection: 'actors',
        id,
        data: { recordStatus: 'hold' },
        overrideAccess: true,
      })
      expect((await v1(`/countries/${code}/actors/juma-hassan`))?.status).toBe(404)
      expect(await sdk.getSeat('en', code, 'mp', 'westlands')).toMatchObject({ holders: [] })
      await payload.update({
        collection: 'actors',
        id,
        data: { recordStatus: 'ready' },
        overrideAccess: true,
      })
    })
  })
})
