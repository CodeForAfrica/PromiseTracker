import { getPayload } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import { setTagRefresher } from '@promisetracker/plugin-core'
import { sectionField } from '@promisetracker/plugin-site'
import { createSdk, isNotAvailable } from '@promisetracker/sdk'
import type { CollectionSlug, Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { richText } from '../../seed/seed'
import { unusedCountryCodes } from '../countries'
import { testTransport } from './transport'

/**
 * The editorial layer against the database (sections 7.7, 10.3, 10.6 and
 * 11.2): editor pages and their addresses, articles and their bylines,
 * themes, picks and section overrides, and rich text made safe to show.
 */
describe('editorial content', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let actor: string
  let claim: string
  let heldClaim: string
  const sdk = createSdk(testTransport())
  const word = crypto.randomUUID().slice(0, 8)
  const made: { collection: CollectionSlug; id: string }[] = []

  const create = async (collection: CollectionSlug, data: Record<string, unknown>) => {
    const doc = await payload.create({
      collection,
      data: data as never,
      locale: 'en',
      overrideAccess: true,
    })
    made.unshift({ collection, id: String(doc.id) })
    return String(doc.id)
  }

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async () => {})
    ;[code = 'cv'] = (await unusedCountryCodes(payload, 1)) as CountryCode[]
    country = await create('countries', { code, recordStatus: 'ready' })
    actor = await create('actors', {
      name: `Ilvanne ${word}`,
      kind: 'person',
      country,
      recordStatus: 'ready',
    })
    // A person appears once their first term starts.
    const office = await create('offices', {
      name: 'President',
      areaType: 'country',
      holdersPerSeat: 1,
      order: 1,
      country,
    })
    await create('terms', { actor, office, startsOn: '2022-09-13T12:00:00.000Z' })
    const topic = await create('topics', { name: `${word} water` })
    // A claim is published with a topic and a source, once verified (sections 5.1 and 8.1).
    const ready = {
      topic,
      sourceUrl: 'https://example.org/manifesto',
      recordStatus: 'ready',
      verification: { verdict: 'verified' },
    }
    claim = await create('claims', { title: `Pipe ${word} water`, actor, ...ready })
    heldClaim = await create('claims', {
      title: `Pave ${word} roads`,
      actor,
      ...ready,
      recordStatus: 'hold',
    })
  })

  afterAll(async () => {
    await payload.updateGlobal({
      slug: 'site',
      data: {
        picks: { featuredClaim: null, inFocus: null, featuredArea: null },
        countryPicks: [],
        sections: {},
      } as never,
      overrideAccess: true,
    })
    for (const { collection, id } of made) {
      await payload.delete({ collection, id, overrideAccess: true, trash: true }).catch(() => {})
    }
  })

  describe('editor pages (section 11.2)', () => {
    it.each([
      ['ke', 'two letters, which are for countries'],
      ['topics', 'one of the site’s own words'],
      ['themes', 'one of the site’s own words'],
      ['search', 'one of the site’s own words'],
      ['opengraph-image', 'one of the site’s own words'],
      ['officials', 'a word a country’s addresses use'],
    ])('refuses the slug "%s": %s', async (slug) => {
      await expect(
        payload.create({
          collection: 'pages',
          data: { title: `Page ${word}`, slug } as never,
          locale: 'en',
          overrideAccess: true,
        }),
      ).rejects.toThrow(/two-letter|used by the site/)
    })

    it('nests pages, moves those under one that moves, and leads a link page to the sister site', async () => {
      const about = await create('pages', {
        title: 'About',
        slug: `about-${word}`,
        body: richText([{ p: 'Who we are.' }]),
        recordStatus: 'ready',
      })
      await create('pages', {
        title: 'Guides',
        slug: 'guides',
        parent: about,
        recordStatus: 'ready',
      })
      await create('pages', {
        title: 'Fact-checks',
        slug: 'fact-checks',
        parent: about,
        link: 'https://pesacheck.org',
        recordStatus: 'ready',
      })
      const page = await sdk.getPage('en', `about-${word}`)
      if (isNotAvailable(page)) throw new Error('The page is not public.')
      expect(page.body).toBe('<p>Who we are.</p>')
      expect(page.children.map((c) => [c.path, c.link])).toEqual([
        [`about-${word}/guides`, null],
        [`about-${word}/fact-checks`, 'https://pesacheck.org'],
      ])
      const guides = await sdk.getPage('en', `about-${word}/guides`)
      if (isNotAvailable(guides)) throw new Error('The page is not public.')
      expect(guides.parents.map((p) => p.title)).toEqual(['About'])

      await payload.update({
        collection: 'pages',
        id: about,
        data: { slug: `who-we-are-${word}` },
        overrideAccess: true,
      })
      const moved = await sdk.getPage('en', `who-we-are-${word}/guides`)
      expect(isNotAvailable(moved) ? null : moved.title).toBe('Guides')
      // The sitemap's list has every published page by its address, link pages marked.
      const list = await sdk.getPages('en')
      expect(
        list.items
          .filter((p) => p.path.startsWith(`who-we-are-${word}`))
          .map((p) => [p.path, p.link]),
      ).toEqual([
        [`who-we-are-${word}`, null],
        [`who-we-are-${word}/fact-checks`, 'https://pesacheck.org'],
        [`who-we-are-${word}/guides`, null],
      ])
    })

    it('refuses a second page at the same address', async () => {
      await create('pages', { title: 'Team', slug: `team-${word}` })
      await expect(
        payload.create({
          collection: 'pages',
          data: { title: 'Team again', slug: `team-${word}` } as never,
          locale: 'en',
          overrideAccess: true,
        }),
      ).rejects.toThrow(/Another page/)
    })
  })

  describe('articles (section 7.7)', () => {
    it('shows a byline only when set and not hidden, and lists articles about a record', async () => {
      const body = richText([
        { p: 'What changed.' },
        { link: { text: 'A safe source', url: 'https://example.org/source' } },
        { link: { text: 'An unsafe one', url: 'javascript:alert(1)' } },
      ])
      const base = { country, about: { relationTo: 'claims', value: claim }, recordStatus: 'ready' }
      await create('articles', {
        ...base,
        title: `First look ${word}`,
        date: '2024-01-10',
        body,
      })
      await create('articles', {
        ...base,
        title: `Second look ${word}`,
        date: '2024-03-01',
        byline: 'A. Writer',
      })
      await create('articles', {
        ...base,
        title: `Third look ${word}`,
        date: '2024-02-01',
        byline: 'B. Writer',
        hideByline: true,
      })
      const list = await sdk.getArticles('en', code, { about: `claim:pipe-${word}-water` })
      // The latest first.
      expect(list.items.map((a) => [a.title, a.byline])).toEqual([
        [`Second look ${word}`, 'A. Writer'],
        [`Third look ${word}`, null],
        [`First look ${word}`, null],
      ])
      const found = await sdk.getClaim('en', code, `pipe-${word}-water`)
      if (isNotAvailable(found)) throw new Error('The claim is not public.')
      expect(found.analysis).toHaveLength(3)

      const first = await sdk.getArticle('en', code, `first-look-${word}`)
      if (isNotAvailable(first)) throw new Error('The article is not public.')
      // A link to anything but the web, email or this site loses its address.
      expect(first.body).toContain('href="https://example.org/source"')
      expect(first.body).not.toContain('javascript:')
      expect(first.body).toContain('href="#"')
    })

    it('leaves out an article whose subject is not public, and refuses one in another country', async () => {
      await create('articles', {
        country,
        about: { relationTo: 'claims', value: heldClaim },
        title: `Held subject ${word}`,
        date: '2024-04-01',
        recordStatus: 'ready',
      })
      const list = await sdk.getArticles('en', code)
      expect(list.items.map((a) => a.title)).not.toContain(`Held subject ${word}`)

      const [elsewhere = 'ls'] = (await unusedCountryCodes(payload, 1)) as CountryCode[]
      const otherCountry = await create('countries', { code: elsewhere, recordStatus: 'ready' })
      await expect(
        payload.create({
          collection: 'articles',
          data: {
            country: otherCountry,
            about: { relationTo: 'claims', value: claim },
            title: `Wrong country ${word}`,
            date: '2024-04-01',
          } as never,
          locale: 'en',
          overrideAccess: true,
        }),
      ).rejects.toThrow(/in the article’s country/)
    })
  })

  describe('themes, picks and sections', () => {
    it('lists only published claims in a theme, and gives the picks only while they are public', async () => {
      const theme = await create('themes', {
        title: `Water ${word}`,
        claims: [heldClaim, claim],
        countries: [country],
        recordStatus: 'ready',
      })
      const found = await sdk.getTheme('en', `water-${word}`)
      if (isNotAvailable(found)) throw new Error('The theme is not public.')
      expect((await sdk.getThemes('en')).items.map((t) => t.slug)).toContain(`water-${word}`)
      expect(found.claims.map((c) => c.slug)).toEqual([`pipe-${word}-water`])
      expect(found.figures.map((f) => f.country.code)).toEqual([code])

      // Saved as an editor would, who can pick a claim still on hold.
      const editor = await create('users', {
        email: `editor-${word}@example.org`,
        password: `pw-${crypto.randomUUID()}`,
        name: 'Editor',
        roles: ['super-admin'],
      })
      await payload.updateGlobal({
        slug: 'site',
        user: {
          ...(await payload.findByID({ collection: 'users', id: editor, overrideAccess: true })),
          collection: 'users',
        },
        data: {
          picks: { featuredClaim: heldClaim, inFocus: theme },
          countryPicks: [{ country, actors: [actor], claims: [heldClaim, claim] }],
        } as never,
        overrideAccess: true,
      })
      const site = await sdk.getSiteInfo('en')
      // The held claim is not public, so it is no pick.
      expect(site.picks.featuredClaim).toBeNull()
      expect(site.picks.inFocus).toBe(`water-${word}`)
      const picked = await sdk.getCountry('en', code)
      if (isNotAvailable(picked)) throw new Error('The country is not public.')
      expect(picked.picks.actors.map((a) => a.name)).toEqual([`Ilvanne ${word}`])
      expect(picked.picks.claims.map((c) => c.slug)).toEqual([`pipe-${word}-water`])
    })

    it('tells the site which sections an editor forced on or off, and no others', async () => {
      await payload.updateGlobal({
        slug: 'site',
        data: {
          sections: {
            [sectionField('home.partners')]: 'off',
            [sectionField('country.officials')]: 'on',
            [sectionField('home.tracked')]: 'auto',
          },
        } as never,
        overrideAccess: true,
      })
      const site = await sdk.getSiteInfo('en')
      expect(site.sections).toEqual({ 'home.partners': 'off', 'country.officials': 'on' })
    })

    it('keeps interface text an editor saved, per language, and fills the rest', async () => {
      await payload.updateGlobal({
        slug: 'site',
        locale: 'fr',
        data: { strings: { inFocus: 'En ce moment' } } as never,
        overrideAccess: true,
      })
      const fr = await sdk.getSiteInfo('fr')
      expect(fr.strings.inFocus).toBe('En ce moment')
      expect(fr.strings.latestAnalysis).toBe('Dernières analyses')
      const en = await sdk.getSiteInfo('en')
      expect(en.strings.inFocus).toBe('In focus')
      await expect(
        payload.updateGlobal({
          slug: 'site',
          locale: 'fr',
          data: { strings: { notAString: 'x' } } as never,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
      await payload.updateGlobal({
        slug: 'site',
        locale: 'fr',
        data: { strings: null } as never,
        overrideAccess: true,
      })
    })
  })
})
