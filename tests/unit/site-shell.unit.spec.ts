import { readRefreshRequest, sign, verify, webUrl } from '@promisetracker/cms'
import { STRING_KEYS } from '@promisetracker/contract'
import { Countries, computePublishedIn } from '@promisetracker/plugin-core'
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
  const body = JSON.stringify({ tags: ['country:ke', 'countries'] })

  it('is accepted when signed with the application secret', () => {
    expect(readRefreshRequest(body, sign(body, secret), secret)).toEqual([
      'country:ke',
      'countries',
    ])
  })

  it('is refused unsigned, wrongly signed, changed, or malformed', () => {
    expect(readRefreshRequest(body, null, secret)).toBeNull()
    expect(readRefreshRequest(body, sign(body, 'another-secret'), secret)).toBeNull()
    expect(readRefreshRequest(body.replace('ke', 'sn'), sign(body, secret), secret)).toBeNull()
    expect(readRefreshRequest(body, 'zz', secret)).toBeNull()
    const empty = JSON.stringify({ tags: [] })
    expect(readRefreshRequest(empty, sign(empty, secret), secret)).toBeNull()
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
