import { createLocalTransport, getPayload, handleV1 } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import { countryName, setTagRefresher } from '@promisetracker/plugin-core'
import { createSdk, NotFoundError } from '@promisetracker/sdk'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Countries, languages and the API the site reads them through (sections 7.1,
 * 8.1, 8.3 and 12). The tests use small countries no one is tracking, and
 * remove only what they created.
 */
describe('countries and languages', () => {
  let payload: Payload
  const sdk = createSdk(createLocalTransport())
  const created: string[] = []
  const refreshed: string[][] = []
  // Set in beforeAll: a country in every language, one with no French name, and one on hold.
  let full: CountryCode
  let noFrench: CountryCode
  let held: CountryCode
  let another: CountryCode

  const v1 = (path: string, query: Record<string, string>) =>
    handleV1(payload, path, new URLSearchParams(query))

  const create = async (data: Record<string, unknown>) => {
    const doc = await payload.create({
      collection: 'countries',
      locale: 'en',
      data: { recordStatus: 'hold', ...data } as never,
      // Test set-up writes as the system.
      overrideAccess: true,
    })
    created.push(doc.id)
    return doc
  }

  beforeAll(async () => {
    payload = await getPayload()
    ;[full = 'st', noFrench = 'km', held = 'sc', another = 'cv'] = await unusedCountryCodes(
      payload,
      4,
    )
    setTagRefresher(async (tags) => {
      refreshed.push([...tags])
    })
  })

  afterAll(async () => {
    if (created.length) {
      await payload.delete({
        collection: 'countries',
        where: { id: { in: created } },
        overrideAccess: true,
      })
    }
    await payload.destroy()
  })

  describe('languages (D45)', () => {
    it('registers every language in the schema, whatever PT_LOCALES says', () => {
      expect(payload.config.localization ? payload.config.localization.localeCodes : []).toEqual([
        'en',
        'fr',
        'pt',
        'ar',
        'sw',
      ])
    })

    it('shows only the languages PT_LOCALES switches on in the admin, English first', async () => {
      const localization = payload.config.localization
      if (!localization) throw new Error('localization is off')
      const shown = await localization.filterAvailableLocales?.({
        locales: localization.locales,
        req: {} as PayloadRequest,
      })
      // The integration tests run with PT_LOCALES=en,fr,ar.
      expect(shown?.map((l) => l.code)).toEqual(['en', 'fr', 'ar'])
    })

    it('gives the site its languages with their direction', async () => {
      const site = await sdk.getSiteInfo('ar')
      expect(site.languages).toEqual([
        { code: 'en', label: 'English', rtl: false },
        { code: 'fr', label: 'Français', rtl: false },
        { code: 'ar', label: 'العربية', rtl: true },
      ])
      expect(site.locale).toBe('ar')
      expect(site.defaultLanguage).toBe('en')
    })
  })

  describe('choosing a country from the list', () => {
    it('fills in its name in every language, its region and its languages', async () => {
      const doc = await create({ code: full })
      const stored = await payload.findByID({
        collection: 'countries',
        id: doc.id,
        locale: 'all',
        overrideAccess: true,
      })
      expect(stored.name).toEqual({
        en: countryName(full, 'en'),
        fr: countryName(full, 'fr'),
        pt: countryName(full, 'pt'),
        ar: countryName(full, 'ar'),
        sw: countryName(full, 'sw'),
      })
      expect(doc.region).toBeTruthy()
      expect(doc.languages?.length).toBeGreaterThan(0)
      expect(doc.languages).toContain(doc.defaultLanguage)
    })

    it('keeps what an editor enters', async () => {
      const doc = await create({
        code: noFrench,
        name: 'An editor’s name',
        region: 'west-africa',
        languages: ['en'],
        defaultLanguage: 'en',
      })
      expect(doc).toMatchObject({
        name: 'An editor’s name',
        region: 'west-africa',
        languages: ['en'],
        defaultLanguage: 'en',
      })
    })

    it('refuses a code that is not on the list, and a language not registered', async () => {
      for (const data of [
        { code: 'KE' },
        { code: 'xx' },
        { code: held, languages: ['de'] },
        { code: held, languages: ['en'], defaultLanguage: 'fr' },
      ]) {
        await expect(create(data), JSON.stringify(data)).rejects.toThrow()
      }
    })
  })

  describe('the published status (section 8.1)', () => {
    it('is no language while the country is on hold', async () => {
      const [doc] = (
        await payload.find({
          collection: 'countries',
          where: { code: { equals: full } },
          overrideAccess: true,
        })
      ).docs
      expect(doc?.publishedIn ?? []).toEqual([])
    })

    it('is each language with a name once the country is ready', async () => {
      const ready = async (code: CountryCode) =>
        (
          await payload.update({
            collection: 'countries',
            where: { code: { equals: code } },
            locale: 'en',
            data: { recordStatus: 'ready' },
            overrideAccess: true,
          })
        ).docs[0]
      expect((await ready(full))?.publishedIn).toEqual(['en', 'fr', 'pt', 'ar', 'sw'])

      // Without a French name, the country leaves the French site.
      await payload.update({
        collection: 'countries',
        where: { code: { equals: noFrench } },
        locale: 'fr',
        data: { name: null },
        overrideAccess: true,
      })
      expect((await ready(noFrench))?.publishedIn).toEqual(['en', 'pt', 'ar', 'sw'])
    })

    it('refreshes a new country’s pages once, not once per language filled in', async () => {
      const before = refreshed.length
      await create({ code: another })
      expect(refreshed.length - before).toBe(1)
    })

    it('leaves the caller’s language alone while filling names', async () => {
      // Names are read in every language through a copy of the request. If the
      // caller's request were used, this French save would come back in every
      // language, as an object.
      const [doc] = (
        await payload.update({
          collection: 'countries',
          where: { code: { equals: full } },
          locale: 'fr',
          data: { about: 'Toujours en français' },
          overrideAccess: true,
        })
      ).docs
      expect(doc?.name).toBe(countryName(full, 'fr'))
      expect(doc?.about).toBe('Toujours en français')
    })

    it('refreshes only after the save commits, so the site reads the new data', async () => {
      // The refresher reads the country the way the web process would: on
      // another connection, which sees only committed data.
      const seen: (string | null | undefined)[] = []
      setTagRefresher(async () => {
        const [doc] = (
          await payload.find({
            collection: 'countries',
            where: { code: { equals: another } },
            locale: 'en',
            overrideAccess: true,
          })
        ).docs
        seen.push(doc?.about)
      })
      try {
        await payload.update({
          collection: 'countries',
          where: { code: { equals: another } },
          locale: 'en',
          data: { about: 'Committed before the refresh' },
          overrideAccess: true,
        })
      } finally {
        setTagRefresher(async (tags) => {
          refreshed.push([...tags])
        })
      }
      expect(seen).toEqual(['Committed before the refresh'])
    })

    it('refreshes the country’s cached pages on every change', () => {
      expect(refreshed.length).toBeGreaterThanOrEqual(3)
      for (const tags of refreshed) {
        expect(tags).toEqual([expect.stringMatching(/^country:[a-z]{2}$/), 'countries'])
      }
    })
  })

  describe('the API (section 12)', () => {
    beforeAll(async () => {
      await create({ code: held })
    })

    it('lists the countries published in the language asked for', async () => {
      const en = (await sdk.getCountries('en')).items.map((c) => c.code)
      const fr = (await sdk.getCountries('fr')).items.map((c) => c.code)
      expect(en).toEqual(expect.arrayContaining([full, noFrench]))
      expect(en).not.toContain(held)
      expect(fr).toContain(full)
      expect(fr).not.toContain(noFrench)
    })

    it('returns a country in its language, and never another language’s text', async () => {
      await payload.update({
        collection: 'countries',
        where: { code: { equals: full } },
        locale: 'fr',
        data: { about: 'À propos' },
        overrideAccess: true,
      })
      await expect(sdk.getCountry('fr', full)).resolves.toMatchObject({
        code: full,
        name: countryName(full, 'fr'),
        about: 'À propos',
      })
      await expect(sdk.getCountry('en', full)).resolves.toMatchObject({
        name: countryName(full, 'en'),
        about: null,
      })
    })

    it('answers "not available" with the languages a country is in (section 8.3)', async () => {
      const result = await v1(`/countries/${noFrench}`, { locale: 'fr' })
      expect(result).toEqual({
        status: 404,
        body: {
          error: 'not-available',
          availableIn: [
            { code: 'en', label: 'English', rtl: false },
            { code: 'ar', label: 'العربية', rtl: true },
          ],
        },
      })
    })

    it('hides a country on hold, and one that is not tracked', async () => {
      await expect(sdk.getCountry('en', held)).rejects.toBeInstanceOf(NotFoundError)
      await expect(sdk.getCountry('en', 'zz')).rejects.toBeInstanceOf(NotFoundError)
    })

    it('says nothing about a country on hold, not even the languages it has', async () => {
      // A guest gets a plain "not found", as for a country that does not exist.
      // "Not available" names languages, and is only for a published country.
      for (const locale of ['en', 'fr']) {
        await expect(v1(`/countries/${held}`, { locale })).resolves.toEqual({
          status: 404,
          body: { error: 'not-found' },
        })
      }
    })

    it('answers 404, not a server error, for a malformed address', async () => {
      await expect(v1('/countries/%E0%A4%A', { locale: 'en' })).resolves.toBeUndefined()
    })

    it('needs a language the site runs in (section 12.2)', async () => {
      for (const query of [{}, { locale: 'de' }, { locale: 'sw' }]) {
        const result = await v1('/countries', query)
        expect(result?.status, JSON.stringify(query)).toBe(400)
      }
    })
  })

  describe('rules', () => {
    it('lets only a super-admin manage countries', async () => {
      const editor = await payload.create({
        collection: 'users',
        data: {
          email: `editor-${crypto.randomUUID()}@example.org`,
          password: crypto.randomUUID(),
          roles: ['editor'],
        },
        overrideAccess: true,
      })
      try {
        await expect(
          payload.create({
            collection: 'countries',
            data: { code: 'dj', recordStatus: 'hold' },
            user: { ...editor, collection: 'users' },
            overrideAccess: false,
          }),
        ).rejects.toThrow()
      } finally {
        await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true })
      }
    })
  })
})
