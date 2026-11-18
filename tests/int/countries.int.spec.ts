import { createLocalTransport, getPayload, handleV1 } from '@promisetracker/cms'
import { setTagRefresher } from '@promisetracker/plugin-core'
import { createSdk, NotFoundError } from '@promisetracker/sdk'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Countries, languages and the API the site reads them through (sections 7.1,
 * 8.1, 8.3 and 12). Codes zx, zw and zv are user-assigned ISO codes, so they
 * never clash with a real country in a shared database.
 */
describe('countries and languages', () => {
  let payload: Payload
  const sdk = createSdk(createLocalTransport())
  const codes = ['zx', 'zw', 'zv']
  const refreshed: string[][] = []

  const remove = () =>
    payload.delete({
      collection: 'countries',
      where: { code: { in: codes } },
      overrideAccess: true,
    })

  const v1 = (path: string, query: Record<string, string>) =>
    handleV1(payload, path, new URLSearchParams(query))

  beforeAll(async () => {
    payload = await getPayload()
    await remove()
    setTagRefresher(async (tags) => {
      refreshed.push([...tags])
    })
  })

  afterAll(async () => {
    await remove()
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

  describe('the published status (section 8.1)', () => {
    it('is no language while the country is on hold', async () => {
      const doc = await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code: 'zx', name: 'Testland', languages: ['en', 'fr'], recordStatus: 'hold' },
        overrideAccess: true,
      })
      expect(doc.recordStatus).toBe('hold')
      expect(doc.publishedIn ?? []).toEqual([])
    })

    it('is each language with a name once the country is ready', async () => {
      const [doc] = (
        await payload.update({
          collection: 'countries',
          where: { code: { equals: 'zx' } },
          locale: 'en',
          data: { recordStatus: 'ready' },
          overrideAccess: true,
        })
      ).docs
      expect(doc?.publishedIn).toEqual(['en'])

      const [withFrench] = (
        await payload.update({
          collection: 'countries',
          where: { code: { equals: 'zx' } },
          locale: 'fr',
          data: { name: 'Pays de test', about: 'À propos' },
          overrideAccess: true,
        })
      ).docs
      expect(withFrench?.publishedIn).toEqual(['en', 'fr'])
    })

    it('refreshes the country’s cached pages on every change', () => {
      expect(refreshed.length).toBeGreaterThanOrEqual(3)
      for (const tags of refreshed) expect(tags).toEqual(['country:zx', 'countries'])
    })
  })

  describe('the API (section 12)', () => {
    beforeAll(async () => {
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code: 'zw', name: 'English only', recordStatus: 'ready' },
        overrideAccess: true,
      })
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code: 'zv', name: 'Held', recordStatus: 'hold' },
        overrideAccess: true,
      })
    })

    it('lists the countries published in the language asked for', async () => {
      const en = (await sdk.getCountries('en')).items.map((c) => c.code)
      const fr = (await sdk.getCountries('fr')).items.map((c) => c.code)
      expect(en).toEqual(expect.arrayContaining(['zx', 'zw']))
      expect(en).not.toContain('zv')
      expect(fr).toContain('zx')
      expect(fr).not.toContain('zw')
    })

    it('returns a country in its language, and never another language’s text', async () => {
      await expect(sdk.getCountry('fr', 'zx')).resolves.toMatchObject({
        code: 'zx',
        name: 'Pays de test',
        about: 'À propos',
      })
      await expect(sdk.getCountry('en', 'zx')).resolves.toMatchObject({
        name: 'Testland',
        about: null,
      })
    })

    it('answers "not available" with the languages a country is in (section 8.3)', async () => {
      const result = await v1('/countries/zw', { locale: 'fr' })
      expect(result).toEqual({
        status: 404,
        body: {
          error: 'not-available',
          availableIn: [{ code: 'en', label: 'English', rtl: false }],
        },
      })
    })

    it('hides a country on hold, and one that does not exist', async () => {
      await expect(sdk.getCountry('en', 'zv')).rejects.toBeInstanceOf(NotFoundError)
      await expect(sdk.getCountry('en', 'zz')).rejects.toBeInstanceOf(NotFoundError)
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
            data: { code: 'zv', name: 'Nope', recordStatus: 'hold' },
            user: { ...editor, collection: 'users' },
            overrideAccess: false,
          }),
        ).rejects.toThrow()
      } finally {
        await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true })
      }
    })

    it('refuses a code that is not two lower-case letters, and a language not registered', async () => {
      const hold = 'hold' as const
      for (const data of [
        { code: 'KE', name: 'x', recordStatus: hold },
        { code: 'ken', name: 'x', recordStatus: hold },
        { code: 'zv', name: 'x', recordStatus: hold, languages: ['de'] },
        { code: 'zv', name: 'x', recordStatus: hold, languages: ['en'], defaultLanguage: 'fr' },
      ]) {
        await expect(
          payload.create({ collection: 'countries', locale: 'en', data, overrideAccess: true }),
          JSON.stringify(data),
        ).rejects.toThrow()
      }
    })
  })
})
