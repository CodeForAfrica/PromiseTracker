import { randomUUID } from 'node:crypto'

import { assertExtensions, getPayload, handleV1, REQUIRED_EXTENSIONS } from '@promisetracker/cms'
import { SearchResults } from '@promisetracker/contract'
import type { CountryCode } from '@promisetracker/plugin-core'
import {
  emptySearches,
  SEARCH_LOG_SLUG,
  SEARCH_PRIORITY,
  SEARCH_SLUG,
} from '@promisetracker/plugin-core'
import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import { createPayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { unusedCountryCodes } from '../countries'

type Indexed = 'areas' | 'actors' | 'claims' | 'topics'
type Entry = {
  id: string
  title: Record<string, string | null | undefined> | null
  kind: string
  country: string | null
  url: string
  priority: number
}

/**
 * Search (sections 7.11 and 16.2), on a small fictional country: a county with
 * an accent in its name and a constituency inside it, each with a seat, and a
 * president above them. Names are made up so no seeded record matches them.
 */
describe('search', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let other: CountryCode
  let otherId: string
  const ids = { root: '', county: '', constituency: '', claim: '', topic: '' }
  const actors = { president: '', governor: '', member: '' }
  const users: string[] = []
  const word = `Quorvane${randomUUID().slice(0, 4)}`

  const search = async (q: string, extra: Record<string, string> = {}, locale = 'en') => {
    const result = await handleV1(payload, '/search', new URLSearchParams({ locale, q, ...extra }))
    expect(result?.status, q).toBe(200)
    return SearchResults.parse(result?.body)
  }
  const entryOf = async (collection: Indexed, id: string): Promise<Entry | null> => {
    const { docs } = await payload.find({
      collection: SEARCH_SLUG as CollectionSlug,
      where: {
        and: [{ 'doc.relationTo': { equals: collection } }, { 'doc.value': { equals: id } }],
      },
      locale: 'all',
      depth: 0,
      // Reads the index as the system, to see every language at once.
      overrideAccess: true,
    })
    expect(docs.length).toBeLessThanOrEqual(1)
    return (docs[0] as unknown as Entry | undefined) ?? null
  }
  const setStatus = (
    collection: 'claims' | 'actors' | 'countries' | 'areas',
    id: string,
    recordStatus: 'ready' | 'hold',
  ) => payload.update({ collection, id, data: { recordStatus }, overrideAccess: true })

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'sz', other = 'ls'] = await unusedCountryCodes(payload, 2)
    // Test set-up writes as the system.
    const create = <T extends Record<string, unknown>>(
      collection: CollectionSlug,
      data: T,
      locale = 'en',
    ) =>
      payload.create({
        collection,
        data: data as never,
        locale: locale as never,
        overrideAccess: true,
      })
    country = (await create('countries', { code, recordStatus: 'ready' })).id as string
    otherId = (await create('countries', { code: other, recordStatus: 'ready' })).id as string
    ids.root = (
      await create('areas', { name: 'Vellmora', type: 'country', country, recordStatus: 'ready' })
    ).id as string
    ids.county = (
      await create('areas', {
        name: `Kâlimbo ${word} County`,
        type: 'county',
        parent: ids.root,
        country,
        recordStatus: 'ready',
      })
    ).id as string
    ids.constituency = (
      await create('areas', {
        name: `Tarsk ${word} North`,
        type: 'constituency',
        parent: ids.county,
        country,
        recordStatus: 'ready',
      })
    ).id as string
    const office = async (name: string, areaType: string, order: number) =>
      (await create('offices', { name, areaType, holdersPerSeat: 1, order, country })).id as string
    const seat = async (name: string, officeId: string, area: string | null) => {
      const actor = (
        await create('actors', { name, kind: 'person', country, recordStatus: 'ready' })
      ).id as string
      await create('terms', {
        actor,
        office: officeId,
        ...(area ? { area } : {}),
        startsOn: '2022-09-13T12:00:00.000Z',
      })
      return actor
    }
    actors.president = await seat('Ilvanne Drosk', await office('President', 'country', 1), null)
    actors.governor = await seat('Merrow Tálvik', await office('Governor', 'county', 2), ids.county)
    actors.member = await seat(
      'Oskel Brannoway',
      await office('Member', 'constituency', 3),
      ids.constituency,
    )
    ids.topic = (await create('topics', { name: `${word} water` })).id as string
    ids.claim = (
      await create('claims', {
        title: `Pipe ${word} water to every ward`,
        actor: actors.governor,
        topic: ids.topic,
        sourceUrl: 'https://example.org/manifesto',
        recordStatus: 'ready',
        // Only a verified claim is published (section 5.1).
        verification: { verdict: 'verified' },
      })
    ).id as string
  })

  afterAll(async () => {
    for (const collection of ['claims', 'terms', 'actors', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
        trash: true,
      })
    }
    for (const id of [ids.constituency, ids.county, ids.root]) {
      await payload.delete({ collection: 'areas', id, overrideAccess: true, trash: true })
    }
    await payload.delete({ collection: 'topics', id: ids.topic, overrideAccess: true })
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    await payload.delete({ collection: 'countries', id: otherId, overrideAccess: true })
    // The last super-admin cannot be deleted, as in the roles tests, so that one may stay.
    for (const id of users) {
      await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
    }
  })

  describe('the index', () => {
    it('keeps an entry for each area, actor, claim and topic, with its kind, country and address', async () => {
      expect(await entryOf('areas', ids.county)).toMatchObject({
        kind: 'area',
        country: code,
        url: expect.stringMatching(new RegExp(`^/${code}/kalimbo-`)),
        priority: SEARCH_PRIORITY.areas,
      })
      expect(await entryOf('actors', actors.governor)).toMatchObject({
        kind: 'actor',
        country: code,
        url: `/${code}/e/merrow-talvik`,
        priority: SEARCH_PRIORITY.actors,
      })
      expect(await entryOf('claims', ids.claim)).toMatchObject({
        kind: 'claim',
        country: code,
        url: expect.stringMatching(new RegExp(`^/${code}/p/`)),
        priority: SEARCH_PRIORITY.claims,
      })
      expect(await entryOf('topics', ids.topic)).toMatchObject({
        kind: 'topic',
        country: null,
        url: expect.stringMatching(/^\/topics\//),
      })
    })

    it('puts areas and actors above claims', () => {
      expect(SEARCH_PRIORITY.areas).toBeGreaterThan(SEARCH_PRIORITY.claims)
      expect(SEARCH_PRIORITY.actors).toBeGreaterThan(SEARCH_PRIORITY.claims)
    })

    it('has a title only in the languages a record is published in', async () => {
      const before = await entryOf('claims', ids.claim)
      expect(before?.title?.en).toBe(`Pipe ${word} water to every ward`)
      expect(before?.title?.fr ?? null).toBeNull()
      // A French draft is not published, so it stays out of the index.
      await payload.update({
        collection: 'claims',
        id: ids.claim,
        locale: 'fr',
        draft: true,
        data: { title: `Eau ${word} pour chaque quartier` },
        overrideAccess: true,
      })
      expect((await entryOf('claims', ids.claim))?.title?.fr ?? null).toBeNull()
      await payload.update({
        collection: 'claims',
        id: ids.claim,
        locale: 'fr',
        data: { title: `Eau ${word} pour chaque quartier`, _status: 'published' },
        overrideAccess: true,
      })
      expect((await entryOf('claims', ids.claim))?.title?.fr).toBe(
        `Eau ${word} pour chaque quartier`,
      )
      // Words only the French title has find it in French, and not in English.
      const url = (await entryOf('claims', ids.claim))?.url
      const inFrench = await search('pour chaque quartier', {}, 'fr')
      expect(inFrench.claims.map((c) => c.url)).toContain(url)
      const inEnglish = await search('pour chaque quartier', {}, 'en')
      expect(inEnglish.claims.map((c) => c.url)).not.toContain(url)
    })

    it('takes a held record out of the index, and puts it back when it is ready', async () => {
      await setStatus('claims', ids.claim, 'hold')
      expect(await entryOf('claims', ids.claim)).toBeNull()
      expect((await search(`Pipe ${word}`)).claims).toEqual([])
      await setStatus('claims', ids.claim, 'ready')
      expect(await entryOf('claims', ids.claim)).not.toBeNull()
    })

    it('follows the cascade: holding the country takes everything in it out', async () => {
      await setStatus('countries', country, 'hold')
      for (const [collection, id] of [
        ['areas', ids.county],
        ['actors', actors.governor],
        ['claims', ids.claim],
      ] as const) {
        expect(await entryOf(collection, id), collection).toBeNull()
      }
      // Topics belong to no country, so they stay.
      expect(await entryOf('topics', ids.topic)).not.toBeNull()
      await setStatus('countries', country, 'ready')
      expect(await entryOf('areas', ids.county)).not.toBeNull()
      expect(await entryOf('actors', actors.governor)).not.toBeNull()
      expect(await entryOf('claims', ids.claim)).not.toBeNull()
    })

    it('takes a record in the trash out of the index', async () => {
      await payload.update({
        collection: 'claims',
        id: ids.claim,
        data: { deletedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      expect(await entryOf('claims', ids.claim)).toBeNull()
      await payload.update({
        collection: 'claims',
        id: ids.claim,
        data: { deletedAt: null },
        trash: true,
        overrideAccess: true,
      })
      expect(await entryOf('claims', ids.claim)).not.toBeNull()
    })

    it('lets a super-admin rebuild it with the plugin’s reindex action, and no one else', async () => {
      const make = async (role: 'super-admin' | 'editor') => {
        const user = await payload.create({
          collection: 'users',
          data: {
            email: `search-${role}-${randomUUID()}@example.org`,
            password: randomUUID(),
            name: role,
            roles: [role],
          },
          // Test set-up writes as the system. The request below acts as the user.
          overrideAccess: true,
        })
        users.push(user.id)
        return { ...user, collection: 'users' as const }
      }
      const endpoint = payload.collections[SEARCH_SLUG as CollectionSlug]?.config.endpoints
      const reindex = Array.isArray(endpoint) ? endpoint.find((e) => e.path === '/reindex') : null
      if (!reindex) throw new Error('The search plugin has no reindex action')
      const run = async (user: Awaited<ReturnType<typeof make>>) => {
        const req = await createPayloadRequest({ payload, user: user as never })
        ;(req as PayloadRequest).json = async () => ({ collections: ['claims'] })
        return reindex.handler(req as PayloadRequest)
      }

      // The entry goes missing, as if the index fell behind.
      const before = await entryOf('claims', ids.claim)
      await payload.delete({
        collection: SEARCH_SLUG as CollectionSlug,
        id: before?.id ?? '',
        overrideAccess: true,
      })
      expect((await run(await make('editor'))).status).toBe(401)
      expect(await entryOf('claims', ids.claim)).toBeNull()

      expect((await run(await make('super-admin'))).status).toBe(200)
      expect(await entryOf('claims', ids.claim)).toMatchObject({
        kind: 'claim',
        country: code,
        url: before?.url,
        title: { en: `Pipe ${word} water to every ward`, fr: `Eau ${word} pour chaque quartier` },
      })
    })
  })

  describe('/api/v1/search', () => {
    it('finds a place without its accents, with every seat above and below it, the top first', async () => {
      const { places } = await search(`Kalimbo ${word}`)
      expect(places).toHaveLength(1)
      expect(places[0]?.country).toBe(code)
      expect(places[0]?.area.name).toBe(`Kâlimbo ${word} County`)
      expect(
        places[0]?.representatives.map((seat) => [
          seat.office.name,
          seat.area?.name ?? null,
          seat.holders.map((h) => h.slug),
        ]),
      ).toEqual([
        ['President', null, ['ilvanne-drosk']],
        ['Governor', `Kâlimbo ${word} County`, ['merrow-talvik']],
        ['Member', `Tarsk ${word} North`, ['oskel-brannoway']],
      ])
    })

    it('still finds a misspelt place', async () => {
      const { places } = await search(`Kalimbp ${word}`)
      expect(places.map((p) => p.area.name)).toEqual([`Kâlimbo ${word} County`])
    })

    it('answers a smaller place with the seats above it, not its neighbours', async () => {
      const { places } = await search(`Tarsk ${word}`)
      expect(places[0]?.representatives.map((s) => s.office.name)).toEqual([
        'President',
        'Governor',
        'Member',
      ])
    })

    it('returns actors, claims and topics after places', async () => {
      const results = await search(word)
      expect(results.claims.map((c) => c.url)).toContain((await entryOf('claims', ids.claim))?.url)
      expect(results.topics.map((t) => t.title)).toContain(`${word} water`)
      expect(results.total).toBe(
        results.places.length +
          results.actors.length +
          results.claims.length +
          results.topics.length,
      )
      expect((await search('Merrow Talvik')).actors).toContainEqual({
        title: 'Merrow Tálvik',
        url: `/${code}/e/merrow-talvik`,
        country: code,
      })
    })

    it('keeps to one country, and topics, when a country is named', async () => {
      expect((await search(`Kalimbo ${word}`, { country: other })).places).toEqual([])
      expect((await search(`Kalimbo ${word}`, { country: code })).places).toHaveLength(1)
      expect((await search(`${word} water`, { country: other })).topics).toHaveLength(1)
      // A country the site does not have answers as the country would.
      const missing = await handleV1(
        payload,
        '/search',
        new URLSearchParams({ locale: 'en', q: 'Kalimbo', country: 'zz' }),
      )
      expect(missing?.status).toBe(404)
    })

    it('refuses a search too short or too long to mean anything', async () => {
      for (const q of ['', 'a', 'x'.repeat(101)]) {
        const result = await handleV1(payload, '/search', new URLSearchParams({ locale: 'en', q }))
        expect(result?.status, q).toBe(400)
      }
    })

    it('logs each search with its words, language, country and count, and nothing about the person', async () => {
      const nothing = `zzqx ${randomUUID().slice(0, 8)}`
      await search(nothing, { country: code })
      await search(nothing.toUpperCase(), { country: code })
      // The log is written after the answer.
      const docs = await vi.waitFor(async () => {
        const { docs } = await payload.find({
          collection: SEARCH_LOG_SLUG as CollectionSlug,
          where: { query: { like: nothing } },
          sort: '-createdAt',
          depth: 0,
          // Reads the log as the system.
          overrideAccess: true,
        })
        expect(docs).toHaveLength(2)
        return docs
      })
      const [entry] = docs as unknown as Record<string, unknown>[]
      expect(entry).toMatchObject({ locale: 'en', country: code, results: 0 })
      expect(Object.keys(entry ?? {}).sort()).toEqual(
        ['country', 'createdAt', 'id', 'locale', 'query', 'results', 'updatedAt'].sort(),
      )
      // The dashboard widget counts the two as one search that found nothing.
      const admin = await payload.find({
        collection: 'users',
        where: { id: { in: users } },
        overrideAccess: true,
      })
      const listed = await emptySearches(payload, {
        ...admin.docs[0],
        collection: 'users',
      } as never)
      expect(listed.find((row) => row.query.toLowerCase() === nothing)).toMatchObject({ times: 2 })
    })

    it('keeps the log closed to guests, and to signed-in people who are not editors', async () => {
      await expect(
        payload.find({ collection: SEARCH_LOG_SLUG as CollectionSlug, overrideAccess: false }),
      ).rejects.toThrow()
      const viewer = { id: randomUUID(), roles: ['viewer'], collection: 'users' } as never
      await expect(
        payload.find({
          collection: SEARCH_LOG_SLUG as CollectionSlug,
          overrideAccess: false,
          user: viewer,
        }),
      ).rejects.toThrow()
      expect(await emptySearches(payload, viewer)).toEqual([])
      expect(await emptySearches(payload, null)).toEqual([])
    })
  })

  describe('start-up', () => {
    it('finds both extensions search needs, and refuses to start without one', async () => {
      expect(REQUIRED_EXTENSIONS).toEqual(['unaccent', 'pg_trgm'])
      await expect(assertExtensions()).resolves.toBeUndefined()
      await expect(assertExtensions([...REQUIRED_EXTENSIONS, 'pt_missing'])).rejects.toThrow(
        /missing the pt_missing extension/,
      )
    })
  })
})
