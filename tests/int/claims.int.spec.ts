import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createLocalTransport, getPayload, handleV1 } from '@promisetracker/cms'
import type { CountryCode, ImportTarget } from '@promisetracker/plugin-core'
import {
  claimsWithRating,
  csvImporter,
  guessMapping,
  runImportPlan,
} from '@promisetracker/plugin-core'
import { createSdk } from '@promisetracker/sdk'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Claims and topics (sections 7.5, 7.7, 10.4 and 12), with fictional actors
 * and claims in a small country no one tracks.
 */
describe('claims and topics', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  const topics: string[] = []
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
  const claimId = async (slug: string) =>
    (
      await payload.find({
        collection: 'claims',
        where: { and: [{ country: { equals: country } }, { slug: { equals: slug } }] },
        overrideAccess: true,
      })
    ).docs[0]?.id ?? ''
  const v1 = (route: string, query: Record<string, string> = {}) =>
    handleV1(payload, route, new URLSearchParams({ locale: 'en', ...query }))
  const topic = async (name: string, extra: Record<string, unknown> = {}) => {
    const doc = await payload.create({
      collection: 'topics',
      locale: 'en',
      data: { name, ...extra },
      overrideAccess: true,
    })
    topics.unshift(doc.id)
    return doc.id
  }

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'cv'] = await unusedCountryCodes(payload, 1)
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
      ['actors', 'kenya-actors.csv'],
      ['terms', 'kenya-terms.csv'],
    ] as const) {
      expect((await load(target, name)).errors).toEqual([])
    }
    await payload.update({
      collection: 'actors',
      where: { country: { equals: country } },
      data: { recordStatus: 'ready' },
      overrideAccess: true,
    })
    const health = await topic('Health')
    await topic('Clinics', { parent: health })
    await topic('Housing')
  })

  afterAll(async () => {
    await payload.update({
      collection: 'actors',
      where: { country: { equals: country } },
      data: { keyClaim: null },
      overrideAccess: true,
    })
    for (const collection of ['claims', 'terms', 'actors', 'areas', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
      })
    }
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    for (const id of topics)
      await payload.delete({ collection: 'topics', id, overrideAccess: true })
  })

  describe('topics (section 7.7)', () => {
    it('nest one level only', async () => {
      const clinics = (
        await payload.find({ collection: 'topics', where: { slug: { equals: 'clinics' } } })
      ).docs[0]
      await expect(
        payload.create({
          collection: 'topics',
          locale: 'en',
          data: { name: 'Rural clinics', parent: clinics?.id ?? null },
          overrideAccess: true,
        }),
      ).rejects.toThrow('one level')
    })
  })

  describe('importing claims', () => {
    it('reports an actor or topic it cannot find, by spreadsheet row', async () => {
      const result = await runImportPlan(payload, {
        target: 'claims',
        country,
        commit: false,
        headings: ['Title', 'Actor', 'Topic', 'Deadline'],
        rows: [
          { row: 1, values: ['A', 'Nobody Known', 'Health', '2027'] },
          { row: 2, values: ['B', 'Achieng Wekesa', 'Space travel', '2027'] },
          { row: 3, values: ['C', 'Achieng Wekesa', 'Health', '2027-13'] },
        ],
        mapping: { title: 'Title', actor: 'Actor', topic: 'Topic', deadline: 'Deadline' },
      })
      expect(result.errors.map((e) => [e.line, e.message])).toEqual([
        [2, 'Actor "nobody-known" is not an actor in this country. Import the actors first.'],
        [3, 'Topic "space-travel" is not a topic. Add it under Claims > Topics first.'],
        [4, 'Deadline "2027-13" is not a date written as 2027, 2027-08 or 2027-08-09.'],
      ])
    })

    it('imports claims, naming actors and topics by name or slug', async () => {
      const result = await load('claims', 'kenya-claims.csv')
      expect(result).toEqual({ counts: { create: 3, update: 0, skip: 0, failed: 0 }, errors: [] })
      expect((await load('claims', 'kenya-claims.csv', false)).counts.skip).toBe(3)
      await payload.update({
        collection: 'claims',
        where: { country: { equals: country } },
        data: { recordStatus: 'ready' },
        overrideAccess: true,
      })
    })
  })

  describe('rules', () => {
    it('starts a claim on its type’s starting rating, as a Promise', async () => {
      const claim = await payload.findByID({
        collection: 'claims',
        id: await claimId('clean-water-for-every-ward'),
        depth: 1,
        overrideAccess: true,
      })
      expect(claim.currentRating).toBe('unstarted')
      expect(typeof claim.type === 'object' && claim.type?.slug).toBe('promise')
      expect(claim.saidOn).toBe('2022-08-15')
    })

    it('keeps slugs unique in a country, and leads a renamed one to its new address', async () => {
      const actor = (
        await payload.find({
          collection: 'actors',
          where: { and: [{ country: { equals: country } }, { slug: { equals: 'juma-hassan' } }] },
        })
      ).docs[0]
      await expect(
        payload.create({
          collection: 'claims',
          locale: 'en',
          data: {
            title: 'Kibra housing',
            slug: 'kibra-housing',
            actor: actor?.id ?? '',
            recordStatus: 'hold',
          },
          overrideAccess: true,
        }),
      ).rejects.toThrow('Another claim in this country uses "kibra-housing"')
      await payload.update({
        collection: 'claims',
        id: await claimId('a-clinic-in-every-county'),
        data: { slug: 'county-clinics' },
        overrideAccess: true,
      })
      expect(await sdk.getRedirect('en', `/${code}/p/a-clinic-in-every-county`)).toEqual({
        to: `/${code}/p/county-clinics`,
        permanent: true,
      })
    })

    it('refuses a partial date that is not one', async () => {
      await expect(
        payload.update({
          collection: 'claims',
          id: await claimId('kibra-housing'),
          data: { deadline: '2027-02-30' },
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })

    it('saves the fields its hooks set when an editor creates a claim, with access rules on', async () => {
      const editor = await payload.create({
        collection: 'users',
        data: {
          email: `editor-${crypto.randomUUID()}@example.org`,
          password: crypto.randomUUID(),
          roles: ['editor'],
        },
        overrideAccess: true,
      })
      const actor = (
        await payload.find({
          collection: 'actors',
          where: { and: [{ country: { equals: country } }, { slug: { equals: 'juma-hassan' } }] },
        })
      ).docs[0]
      try {
        const claim = await payload.create({
          collection: 'claims',
          locale: 'en',
          data: { title: 'Pave Westlands roads', actor: actor?.id ?? '', recordStatus: 'hold' },
          user: { ...editor, collection: 'users' },
          overrideAccess: false,
        })
        const saved = await payload.findByID({
          collection: 'claims',
          id: claim.id,
          depth: 0,
          overrideAccess: true,
        })
        expect(saved).toMatchObject({
          country,
          currentRating: 'unstarted',
          updateCount: 0,
          enteredBy: editor.id,
          slug: 'pave-westlands-roads',
        })
        await payload.delete({ collection: 'claims', id: claim.id, overrideAccess: true })
      } finally {
        await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true })
      }
    })

    it('starts a claim on the new scale when its type changes before any rating', async () => {
      const scale = await payload.create({
        collection: 'rating-scales',
        locale: 'en',
        data: {
          name: 'Truth',
          bestValue: 2,
          worstValue: 1,
          tiers: [{ slug: 'checked', label: 'Checked', colour: '#1b4fd8' }],
          ratings: [
            {
              slug: 'unproven',
              label: 'Unproven',
              tier: 'checked',
              definition: 'Not yet checked.',
              colour: '#e4e5e8',
              textColour: '#2a2c26',
              value: 1,
              isStarting: true,
            },
          ],
        },
        overrideAccess: true,
      })
      const type = await payload.create({
        collection: 'claim-types',
        locale: 'en',
        data: { name: 'Statement', slug: 'statement-test', ratingScale: scale.id },
        overrideAccess: true,
      })
      const id = await claimId('clean-water-for-every-ward')
      try {
        const changed = await payload.update({
          collection: 'claims',
          id,
          data: { type: type.id },
          overrideAccess: true,
        })
        expect(changed.currentRating).toBe('unproven')
        // Rated once, it keeps its rating, so it cannot move to a scale without it.
        await payload.update({
          collection: 'claims',
          id,
          data: { type: null },
          overrideAccess: true,
        })
        expect(
          (await payload.findByID({ collection: 'claims', id, overrideAccess: true }))
            .currentRating,
        ).toBe('unstarted')
      } finally {
        await payload.delete({ collection: 'claim-types', id: type.id, overrideAccess: true })
        await payload.delete({ collection: 'rating-scales', id: scale.id, overrideAccess: true })
      }
    })

    it('keeps a claim in its country when its actor changes', async () => {
      const [otherCode = 'gw'] = (await unusedCountryCodes(payload, 2)).filter((c) => c !== code)
      const other = await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code: otherCode, recordStatus: 'hold' },
        overrideAccess: true,
      })
      const stranger = await payload.create({
        collection: 'actors',
        data: { name: 'Elsewhere Person', kind: 'person', country: other.id, recordStatus: 'hold' },
        overrideAccess: true,
      })
      try {
        await expect(
          payload.update({
            collection: 'claims',
            id: await claimId('kibra-housing'),
            data: { actor: stranger.id },
            overrideAccess: true,
          }),
        ).rejects.toThrow('A claim stays in its country')
      } finally {
        await payload.delete({ collection: 'actors', id: stranger.id, overrideAccess: true })
        await payload.delete({ collection: 'countries', id: other.id, overrideAccess: true })
      }
    })

    it('says when a title makes no slug', async () => {
      const actor = (
        await payload.find({
          collection: 'actors',
          where: { and: [{ country: { equals: country } }, { slug: { equals: 'juma-hassan' } }] },
        })
      ).docs[0]
      await expect(
        payload.create({
          collection: 'claims',
          locale: 'ar',
          data: { title: 'وعد', actor: actor?.id ?? '', recordStatus: 'hold' },
          overrideAccess: true,
        }),
      ).rejects.toThrow('A slug cannot be made from this title')
    })

    it('tells a rating scale which claims carry a rating', async () => {
      const scale = (await payload.find({ collection: 'rating-scales', limit: 1 })).docs[0]
      const claims = await claimsWithRating(
        { payload } as PayloadRequest,
        scale?.id ?? '',
        'unstarted',
      )
      expect(claims.map((c) => c.title)).toEqual(
        expect.arrayContaining(['Build 5000 homes in Kibra', 'Clean water for every ward']),
      )
    })
  })

  describe('the API (section 12)', () => {
    it('lists a country’s claims with totals, a cursor and figures as counts', async () => {
      const page = await sdk.getClaims('en', code, { sort: 'title', limit: 2 })
      // "A clinic in every county" comes first by title.
      expect(page.items.map((c) => c.slug)).toEqual(['county-clinics', 'kibra-housing'])
      expect(page).toMatchObject({
        total: 3,
        nextCursor: '2',
        figures: { total: 3, form: 'counts', byRating: { unstarted: 3 }, byTier: { uncertain: 3 } },
      })
      expect(page.items[1]).toMatchObject({
        actor: { slug: 'achieng-wekesa' },
        topic: { slug: 'housing' },
        rating: { slug: 'unstarted', label: 'Unstarted' },
        deadline: { value: '2027', precision: 'year' },
        saidOn: { value: '2022-07', precision: 'month' },
      })
    })

    it('filters by actor, by a topic and those under it, and by rating', async () => {
      const byActor = await sdk.getClaims('en', code, { actor: 'amani-otieno' })
      expect(byActor.items.map((c) => c.slug)).toEqual(['county-clinics'])
      const health = await sdk.getClaims('en', code, { topic: 'health' })
      expect(health.total).toBe(2)
      expect((await sdk.getClaims('en', code, { rating: 'completed' })).total).toBe(0)
    })

    it('shows figures as percentages from the threshold in Settings (section 10.4)', async () => {
      await payload.updateGlobal({
        slug: 'site',
        data: { figuresThreshold: 2 },
        overrideAccess: true,
      })
      expect((await sdk.getClaims('en', code)).figures.form).toBe('percentages')
      await payload.updateGlobal({
        slug: 'site',
        data: { figuresThreshold: 20 },
        overrideAccess: true,
      })
    })

    it('returns a claim, or says which languages it is in', async () => {
      expect(await sdk.getClaim('en', code, 'kibra-housing')).toMatchObject({
        title: 'Build 5000 homes in Kibra',
        statement: 'We will build five thousand homes in Kibra.',
        summary: 'A fictional pledge for the tests.',
        type: { slug: 'promise' },
        deadlineText: 'End of term',
      })
      expect(await sdk.getClaim('fr', code, 'kibra-housing')).toMatchObject({
        title: 'Construire 5 000 logements à Kibra',
      })
      expect(await sdk.getClaim('fr', code, 'clean-water-for-every-ward')).toMatchObject({
        error: 'not-available',
      })
    })

    it('hides a claim on hold, and the claims of an actor on hold', async () => {
      const id = await claimId('kibra-housing')
      await payload.update({
        collection: 'claims',
        id,
        data: { recordStatus: 'hold' },
        overrideAccess: true,
      })
      expect((await v1(`/countries/${code}/claims/kibra-housing`))?.status).toBe(404)
      expect((await sdk.getClaims('en', code)).total).toBe(2)
      await payload.update({
        collection: 'claims',
        id,
        data: { recordStatus: 'ready' },
        overrideAccess: true,
      })
    })

    it('lists topics with their claims, and a topic with figures by country', async () => {
      const { items } = await sdk.getTopics('en')
      expect(items.find((t) => t.slug === 'health')).toMatchObject({ claims: 2 })
      expect(items.find((t) => t.slug === 'clinics')).toMatchObject({
        parent: { slug: 'health', name: 'Health' },
      })
      const health = await sdk.getTopic('en', 'health')
      expect(health).toMatchObject({
        children: [{ slug: 'clinics' }],
        countries: [{ country: { code }, figures: { total: 2, form: 'counts' } }],
      })
    })

    it('gives an actor their record and the key claim an editor chose', async () => {
      const actor = (
        await payload.find({
          collection: 'actors',
          where: {
            and: [{ country: { equals: country } }, { slug: { equals: 'achieng-wekesa' } }],
          },
        })
      ).docs[0]
      await payload.update({
        collection: 'actors',
        id: actor?.id ?? '',
        locale: 'en',
        data: { keyClaim: await claimId('kibra-housing'), keyClaimNote: 'Her flagship pledge.' },
        overrideAccess: true,
      })
      expect(await sdk.getActor('en', code, 'achieng-wekesa')).toMatchObject({
        record: { total: 2, form: 'counts' },
        keyClaim: { claim: { slug: 'kibra-housing' }, note: 'Her flagship pledge.' },
      })
    })
  })
})
