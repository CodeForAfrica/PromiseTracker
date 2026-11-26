import { getPayload } from '@promisetracker/cms'
import { NotAvailable, V1_ENDPOINTS } from '@promisetracker/contract'
import { slugify } from '@promisetracker/plugin-core'
import { createSdk, isNotAvailable } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  readEditorial,
  readTopics,
  SEED_COUNTRIES,
  seedCountry,
  seedEditorial,
  seedTopics,
} from '../../seed/seed'
import { testTransport } from './transport'

/**
 * The seed data loads into an empty database, loads again without changing
 * anything, and gives the site real pages (seed/README.md). Integration tests
 * run on their own database (tests/database.ts), and this one removes only
 * the seed countries it added.
 */
describe('seed data', () => {
  let payload: Payload
  const sdk = createSdk(testTransport())

  const seedCountries = async () =>
    (
      await payload.find({
        collection: 'countries',
        where: { code: { in: [...SEED_COUNTRIES] } },
        overrideAccess: true,
      })
    ).docs

  const seedTopicSlugs = readTopics().map((topic) => slugify(topic.name.en ?? ''))
  // Topics another test made stay; the ones this test adds go again.
  let topicsBefore = new Set<string>()

  beforeAll(async () => {
    payload = await getPayload()
    // The test database starts without them, so everything below is this test's to remove.
    expect(await seedCountries()).toEqual([])
    const { docs } = await payload.find({
      collection: 'topics',
      where: { slug: { in: seedTopicSlugs } },
      pagination: false,
      overrideAccess: true,
    })
    topicsBefore = new Set(docs.map((doc) => String(doc.slug)))
    const topics = await seedTopics(payload)
    expect(topics.create).toBe(seedTopicSlugs.length - topicsBefore.size)
    expect((await seedTopics(payload)).create).toBe(0)
  })

  afterAll(async () => {
    // The editorial seed's records, and the picks that name the countries going below.
    const editorial = readEditorial()
    await payload.updateGlobal({
      slug: 'site',
      data: { picks: { featuredClaim: null, inFocus: null, featuredArea: null }, countryPicks: [] },
      overrideAccess: true,
    })
    for (const [collection, where] of [
      ['themes', { slug: { in: editorial.themes.map((t) => t.slug) } }],
      ['pages', { slug: { in: editorial.pages.map((p) => p.slug) } }],
      ['partners', { name: { in: editorial.partners.map((p) => p.name) } }],
      ['sister-tools', { name: { in: editorial.sisterTools.map((t) => t.name) } }],
    ] as const) {
      await payload.delete({ collection, where, overrideAccess: true, trash: true })
    }
    for (const { id } of await seedCountries()) {
      await payload.delete({
        collection: 'articles',
        where: { country: { equals: id } },
        overrideAccess: true,
        trash: true,
      })
      for (const collection of ['claims', 'terms', 'actors', 'areas', 'offices'] as const) {
        await payload.delete({
          collection,
          where: { country: { equals: id } },
          overrideAccess: true,
        })
      }
      await payload.delete({ collection: 'countries', id, overrideAccess: true })
    }
    // Children first, so no topic is left pointing at a deleted parent.
    for (const slug of [...seedTopicSlugs].reverse()) {
      if (topicsBefore.has(slug)) continue
      await payload.delete({
        collection: 'topics',
        where: { slug: { equals: slug } },
        overrideAccess: true,
      })
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

  it('loads the editorial content once, and the site shows it (section 7.7)', async () => {
    const first = await seedEditorial(payload)
    expect(first).toMatchObject({ failed: 0 })
    expect(first.create).toBeGreaterThan(0)
    const again = await seedEditorial(payload)
    expect(again).toMatchObject({ create: 0, update: 0, failed: 0 })

    const site = await sdk.getSiteInfo('en')
    expect(site.picks).toEqual({
      featuredClaim: { country: 'ke', slug: 'cut-the-price-of-fertiliser' },
      inFocus: 'public-money',
      featuredArea: { country: 'ke', slug: 'nairobi-county' },
    })
    expect(site.partners.map((p) => p.name)).toEqual(['Code for Africa', 'PesaCheck'])
    expect(site.sisterTools.map((t) => t.name)).toEqual(['PesaCheck'])

    const theme = await sdk.getTheme('fr', 'public-money')
    if (isNotAvailable(theme)) throw new Error('The theme is not public in French.')
    expect(theme.title).toBe('L’argent public')
    expect(theme.countries.map((c) => c.code)).toEqual(['ke', 'sn'])
    expect(theme.claims.map((c) => c.slug)).toEqual([
      'cut-the-price-of-fertiliser',
      'review-oil-gas-and-mining-contracts',
      'set-up-a-fund-for-small-traders',
      'audit-public-finances',
    ])
    expect(theme.figures.map((f) => f.country.code)).toEqual(['ke', 'sn'])

    const claim = await sdk.getClaim('en', 'ke', 'cut-the-price-of-fertiliser')
    if (isNotAvailable(claim)) throw new Error('The claim is not public.')
    expect(claim.analysis.map((a) => a.slug)).toEqual(['how-the-fertiliser-price-came-down'])
    const article = await sdk.getArticle('en', 'ke', 'how-the-fertiliser-price-came-down')
    if (isNotAvailable(article)) throw new Error('The article is not public.')
    // No byline is a normal state (section 7.7).
    expect(article.byline).toBeNull()
    expect(article.about).toEqual({
      kind: 'claim',
      slug: 'cut-the-price-of-fertiliser',
      name: 'Cut the price of fertiliser',
    })
    expect(article.body).toContain('<h2>The first phase</h2>')
    expect(article.body).toContain('href="https://citizen.digital/')

    const methodology = await sdk.getPage('fr', 'methodology')
    if (isNotAvailable(methodology)) throw new Error('The methodology is not public in French.')
    expect(methodology.title).toBe('Méthodologie')

    const kenya = await sdk.getCountry('en', 'ke')
    if (isNotAvailable(kenya)) throw new Error('Kenya is not public.')
    expect(kenya.picks.actors.map((a) => a.slug)).toEqual(['william-ruto', 'johnson-sakaja'])
    expect(kenya.picks.claims.map((c) => c.slug)).toEqual([
      'cut-the-price-of-fertiliser',
      'feed-every-pupil-in-nairobis-public-primary-schools',
    ])
    expect(kenya.counts.articles).toBe(1)

    const overview = await sdk.getOverview('en')
    expect(overview.countries).toBeGreaterThanOrEqual(2)
    expect(overview.figures.total).toBeGreaterThan(0)
    expect(overview.sources).toBeGreaterThan(0)
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
    const claims = await sdk.getClaims('fr', 'sn')
    expect(claims.total).toBe(2)
    expect(claims.items[0]?.topic?.name).toBeTruthy()
  })

  it('gives Kenya claims on shared topics, with their figures', async () => {
    const claims = await sdk.getClaims('en', 'ke', { actor: 'william-ruto' })
    expect(claims.total).toBe(5)
    expect(claims.figures).toMatchObject({ total: 5, form: 'counts' })
    expect(await sdk.getTopic('en', 'housing')).toMatchObject({
      children: [{ slug: 'affordable-housing' }],
      countries: [{ country: { code: 'ke' }, figures: { total: 1 } }],
    })
  })

  it('finds everyone who represents Nairobi, from the president down (section 7.11)', async () => {
    const results = await sdk.search('en', 'Nairobi')
    if ('error' in results) throw new Error('Search is not available in English')
    const [place] = results.places
    expect(place?.area.slug).toBe('nairobi-county')
    const seats = (place?.representatives ?? []).map((seat) => ({
      office: seat.office.slug,
      area: seat.area?.slug ?? null,
      holders: seat.holders.map((h) => h.slug),
    }))
    expect(seats.slice(0, 5)).toEqual([
      { office: 'president', area: null, holders: ['william-ruto'] },
      { office: 'deputy-president', area: null, holders: ['kithure-kindiki'] },
      { office: 'governor', area: 'nairobi-county', holders: ['johnson-sakaja'] },
      { office: 'senator', area: 'nairobi-county', holders: ['edwin-sifuna'] },
      { office: 'woman-representative', area: 'nairobi-county', holders: ['esther-passaris'] },
    ])
    // Every MP whose constituency is in Nairobi: all 17 of them, and no one else.
    const constituencies = await sdk.getAreas('en', 'ke', 'nairobi-county')
    expect(constituencies.total).toBe(17)
    const members = seats.slice(5)
    expect(members.every((seat) => seat.office === 'member-of-parliament')).toBe(true)
    expect(members.map((seat) => seat.area).sort()).toEqual(
      constituencies.items.map((area) => area.slug).sort(),
    )
    expect(members.every((seat) => seat.holders.length === 1)).toBe(true)
  })

  it('finds a misspelt county, and a French place without its accents', async () => {
    const misspelt = await sdk.search('en', 'Nairbi')
    expect('places' in misspelt && misspelt.places[0]?.area.slug).toBe('nairobi-county')
    const french = await sdk.search('fr', 'Senegal')
    expect('places' in french && french.places.map((p) => p.area.name)).toContain('Sénégal')
  })

  it('rates claims from their seeded updates, with evidence', async () => {
    const claim = await sdk.getClaim('en', 'ke', 'cut-the-price-of-fertiliser')
    if (isNotAvailable(claim)) throw new Error('The claim is not public.')
    expect(claim.rating?.slug).toBe('completed')
    expect(claim.timeline).toHaveLength(2)
    expect(claim.evidence.every((e) => e.url?.startsWith('https://'))).toBe(true)
    const ruto = await sdk.getActor('en', 'ke', 'william-ruto')
    if (isNotAvailable(ruto)) throw new Error('The actor is not public.')
    expect(ruto.latestChanges.length).toBeGreaterThan(0)
    const audit = await sdk.getClaimHistory('fr', 'sn', 'audit-public-finances')
    if (isNotAvailable(audit)) throw new Error('The history is not public in French.')
    expect(audit.updates[0]?.title).toBe(
      'La Cour des comptes publie son audit des finances publiques',
    )
  })

  it("answers every endpoint in the contract's shape (section 15, rule 3)", async () => {
    const transport = testTransport()
    const [claim] = (await sdk.getClaims('en', 'ke', { actor: 'william-ruto', limit: 1 })).items
    if (!claim) throw new Error('The seed has no claim by William Ruto')
    // One call for each endpoint in the contract, on seeded records.
    const calls: [endpoint: string, path: string, query?: Record<string, string>][] = [
      ['/site', '/site'],
      ['/countries', '/countries'],
      ['/countries/{code}', '/countries/ke'],
      ['/countries/{code}/offices', '/countries/ke/offices'],
      ['/countries/{code}/areas', '/countries/ke/areas', { parent: 'kenya' }],
      ['/countries/{code}/areas/{area}', '/countries/ke/areas/nairobi-county'],
      ['/countries/{code}/seats/{office}', '/countries/ke/seats/president'],
      ['/countries/{code}/seats/{area}/{office}', '/countries/ke/seats/nairobi-county/governor'],
      ['/countries/{code}/actors', '/countries/ke/actors', { stage: 'current', limit: '5' }],
      ['/countries/{code}/actors/{slug}', '/countries/ke/actors/william-ruto'],
      ['/countries/{code}/claims', '/countries/ke/claims', { sort: 'deadline' }],
      ['/countries/{code}/claims/{slug}', `/countries/ke/claims/${claim.slug}`],
      ['/countries/{code}/claims/{slug}/history', `/countries/ke/claims/${claim.slug}/history`],
      ['/countries/{code}/articles', '/countries/ke/articles', { about: `claim:${claim.slug}` }],
      [
        '/countries/{code}/articles/{slug}',
        '/countries/ke/articles/how-the-fertiliser-price-came-down',
      ],
      ['/topics', '/topics'],
      ['/topics/{slug}', '/topics/housing'],
      ['/themes/{slug}', '/themes/public-money'],
      ['/pages', '/pages', { path: 'methodology' }],
      ['/overview', '/overview'],
      ['/search', '/search', { q: 'Nairobi', country: 'ke' }],
      ['/redirects', '/redirects', { path: '/ke/president' }],
    ]
    expect(new Set(calls.map(([endpoint]) => endpoint))).toEqual(
      new Set(V1_ENDPOINTS.map((e) => e.path)),
    )
    for (const [endpoint, path, query] of calls) {
      const { status, body } = await transport.get(path, { locale: 'en', ...query })
      expect(status, path).toBe(200)
      const schema = V1_ENDPOINTS.find((e) => e.path === endpoint)?.response
      expect(schema?.safeParse(body).error, path).toBeUndefined()
    }
    // A claim not published in Arabic, which the tests switch on, answers in the
    // contract's "not available" shape (section 8.3).
    const missing = await transport.get(`/countries/ke/claims/${claim.slug}`, { locale: 'ar' })
    expect(missing.status).toBe(404)
    expect(NotAvailable.safeParse(missing.body).error).toBeUndefined()
  })
})
