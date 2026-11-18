import { readRefreshRequest, sign, verify, webUrl } from '@promisetracker/cms'
import { STRING_KEYS } from '@promisetracker/contract'
import {
  COUNTRY_CODES,
  Countries,
  computePublishedIn,
  countryDefaults,
  countryName,
  countryNames,
  isLocaleCode,
  REGIONS,
} from '@promisetracker/plugin-core'
import { DEFAULT_STRINGS, resolveStrings } from '@promisetracker/plugin-site'
import { localePath, withoutLocale } from '@promisetracker/ui'
import type { Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { matchRoute } from '../../apps/cms/src/api/v1'
import { pickLocale } from '../../apps/site/src/locale'

describe('choosing a language for /', () => {
  const available = ['en', 'fr', 'ar']

  it('takes the visitor’s first language the site runs in', () => {
    expect(pickLocale('fr-SN,fr;q=0.9,en;q=0.8', available, 'en')).toBe('fr')
    expect(pickLocale('de-DE,ar;q=0.5', available, 'en')).toBe('ar')
  })

  it('follows the weights, not only the order', () => {
    expect(pickLocale('en;q=0.4,fr;q=0.9', available, 'en')).toBe('fr')
  })

  it('falls back to the default', () => {
    expect(pickLocale(null, available, 'en')).toBe('en')
    expect(pickLocale('de,es', available, 'en')).toBe('en')
    expect(pickLocale('fr;q=0', available, 'en')).toBe('en')
  })
})

describe('the published status (section 8.1)', () => {
  const locales = ['en', 'fr', 'ar']

  it('is no language until the record is ready', () => {
    expect(computePublishedIn('hold', { name: { en: 'Kenya' } }, locales)).toEqual([])
    expect(computePublishedIn('archived', { name: { en: 'Kenya' } }, locales)).toEqual([])
  })

  it('is each language where every required field has a value', () => {
    const required = { name: { en: 'Kenya', fr: 'Kenya', ar: '  ' }, about: { en: 'x', fr: 'y' } }
    expect(computePublishedIn('ready', required, locales)).toEqual(['en', 'fr'])
    expect(computePublishedIn('ready', { name: { fr: 'Sénégal' } }, locales)).toEqual(['fr'])
  })
})

describe('interface text', () => {
  it('has English and French for every key', () => {
    for (const key of STRING_KEYS) {
      expect(DEFAULT_STRINGS.en[key], key).toBeTruthy()
      expect(DEFAULT_STRINGS.fr[key], key).toBeTruthy()
    }
  })

  it('uses the editor’s text first, then the language’s default, then English', () => {
    const fr = resolveStrings('fr', { menu: 'Le menu', home: '  ' })
    expect(fr.menu).toBe('Le menu')
    expect(fr.home).toBe(DEFAULT_STRINGS.fr.home)
    expect(resolveStrings('ar', null).menu).toBe(DEFAULT_STRINGS.en.menu)
  })
})

describe('/api/v1 routes', () => {
  it('matches a path with parameters', () => {
    expect(matchRoute('/countries/ke')).toEqual({
      pattern: '/countries/:code',
      params: { code: 'ke' },
    })
    expect(matchRoute('/countries')).toEqual({ pattern: '/countries', params: {} })
    expect(matchRoute('/site')).toEqual({ pattern: '/site', params: {} })
  })

  it('matches nothing else', () => {
    expect(matchRoute('/countries/ke/extra')).toBeUndefined()
    expect(matchRoute('/countries/KE')).toBeUndefined()
    expect(matchRoute('/countries/%2e%2e')).toBeUndefined()
    expect(matchRoute('/unknown')).toBeUndefined()
  })
})

describe('the cache refresh request', () => {
  const secret = 'a-test-secret'
  const now = 1_800_000_000_000
  const body = JSON.stringify({ tags: ['country:ke', 'countries'], at: now })

  it('is accepted when signed with the application secret', () => {
    expect(readRefreshRequest(body, sign(body, secret), secret, now)).toEqual([
      'country:ke',
      'countries',
    ])
  })

  it('is refused once it is more than five minutes old, so a copy cannot be replayed', () => {
    const signature = sign(body, secret)
    expect(readRefreshRequest(body, signature, secret, now + 4 * 60_000)).not.toBeNull()
    expect(readRefreshRequest(body, signature, secret, now + 6 * 60_000)).toBeNull()
    const untimed = JSON.stringify({ tags: ['site'] })
    expect(readRefreshRequest(untimed, sign(untimed, secret), secret, now)).toBeNull()
  })

  it('is refused unsigned, wrongly signed, changed, or malformed', () => {
    expect(readRefreshRequest(body, null, secret, now)).toBeNull()
    expect(readRefreshRequest(body, sign(body, 'another-secret'), secret, now)).toBeNull()
    const changed = body.replace('ke', 'sn')
    expect(readRefreshRequest(changed, sign(body, secret), secret, now)).toBeNull()
    expect(readRefreshRequest(body, 'zz', secret, now)).toBeNull()
    const empty = JSON.stringify({ tags: [], at: now })
    expect(readRefreshRequest(empty, sign(empty, secret), secret, now)).toBeNull()
    expect(verify(body, sign(body, secret), '')).toBe(false)
  })

  it('goes to the web process, wherever it is', () => {
    expect(webUrl({})).toBe('http://127.0.0.1:3000')
    expect(webUrl({ PORT: '3100' })).toBe('http://127.0.0.1:3100')
    expect(webUrl({ PT_WEB_URL: 'http://app:3000/' })).toBe('http://app:3000')
  })
})

describe('paths in a language', () => {
  it('adds and removes the language', () => {
    expect(localePath('fr')).toBe('/fr')
    expect(localePath('fr', '/ke')).toBe('/fr/ke')
    expect(withoutLocale('/fr/ke', ['en', 'fr'])).toBe('/ke')
    expect(withoutLocale('/fr', ['en', 'fr'])).toBe('/')
    expect(withoutLocale('/admin', ['en', 'fr'])).toBe('/admin')
  })
})

describe('the record status', () => {
  const hook = (
    Countries.fields.find((f) => 'name' in f && f.name === 'recordStatus') as Field & {
      hooks: { beforeChange: ((args: unknown) => unknown)[] }
    }
  ).hooks.beforeChange[0]
  const run = (roles: string[], value: string, previousValue = 'hold') =>
    hook?.({ value, previousValue, req: { user: { id: 'u1', roles } } })

  it('lets a contributor hold a record, and nothing else', () => {
    expect(run(['contributor'], 'hold', 'ready')).toBe('hold')
    expect(() => run(['contributor'], 'ready')).toThrow('cannot set this record to ready')
  })

  it('lets an editor set any status', () => {
    expect(run(['editor'], 'ready')).toBe('ready')
    expect(run(['editor'], 'archived')).toBe('archived')
  })
})

describe('the country list', () => {
  it('has the 54 African countries, each with a region and registered languages', () => {
    expect(COUNTRY_CODES).toHaveLength(54)
    for (const code of COUNTRY_CODES) {
      const { region, languages, defaultLanguage } = countryDefaults(code)
      expect(REGIONS, code).toContain(region)
      expect(languages.length, code).toBeGreaterThan(0)
      for (const language of languages) expect(isLocaleCode(language), code).toBe(true)
      expect(languages, code).toContain(defaultLanguage)
    }
  })

  it('names a country in every registered language', () => {
    expect(countryNames('sn')).toMatchObject({ en: 'Senegal', fr: 'Sénégal', ar: 'السنغال' })
    expect(countryName('cd', 'en')).toBe('Democratic Republic of the Congo')
    expect(countryName('cg', 'fr')).toBe('République du Congo')
    for (const code of COUNTRY_CODES) {
      for (const locale of ['en', 'fr', 'pt', 'ar', 'sw'] as const) {
        const name = countryName(code, locale)
        expect(name, `${code} ${locale}`).not.toBe(code.toUpperCase())
        expect(name, `${code} ${locale}`).not.toMatch(/ - /)
      }
    }
  })

  it('fills a new country from the list, and keeps what an editor entered', () => {
    const hook = Countries.hooks?.beforeValidate?.[0]
    const run = (data: Record<string, unknown>, locale = 'fr') =>
      hook?.({ data, req: { locale }, operation: 'create' } as never)
    expect(run({ code: 'ke' })).toMatchObject({
      name: 'Kenya',
      region: 'east-africa',
      languages: ['en', 'sw'],
      defaultLanguage: 'en',
    })
    expect(run({ code: 'ci', name: 'Ivory Coast', languages: ['en'] }, 'en')).toMatchObject({
      name: 'Ivory Coast',
      languages: ['en'],
      region: 'west-africa',
      // From the editor's languages, not the list's French.
      defaultLanguage: 'en',
    })
    expect(run({ code: 'not-a-country' })).toEqual({ code: 'not-a-country' })
  })
})
