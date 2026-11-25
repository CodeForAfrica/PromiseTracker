import { liveIn, SEARCHED, skipSync } from '@promisetracker/plugin-core'
import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

/** Which languages a record is in the search index in (section 7.11). */
describe('what the search index holds', () => {
  it('indexes claims, actors, areas and topics', () => {
    expect(Object.keys(SEARCHED).sort()).toEqual(['actors', 'areas', 'claims', 'topics'])
  })

  it('holds a record in the languages it is published in, and none while it is in the trash', () => {
    const claim = { publishedIn: ['en', 'fr'] }
    expect(liveIn('claims', claim, 'en')).toBe(true)
    expect(liveIn('claims', claim, 'ar')).toBe(false)
    expect(liveIn('claims', { publishedIn: [] }, 'en')).toBe(false)
    expect(liveIn('claims', { ...claim, deletedAt: '2026-11-24T00:00:00.000Z' }, 'en')).toBe(false)
    expect(liveIn('claims', claim, undefined)).toBe(false)
  })

  it('holds a topic, which has no publishing rules, in the languages it has a name in', () => {
    expect(liveIn('topics', { name: 'Health' }, 'en')).toBe(true)
    expect(liveIn('topics', { name: { en: 'Health', fr: '' } }, 'fr')).toBe(false)
    expect(liveIn('topics', { name: { en: 'Health', fr: 'Santé' } }, 'fr')).toBe(true)
  })

  it('tells the search plugin to skip a language a record is not live in', async () => {
    const args = { collectionSlug: 'actors', req: {} as PayloadRequest }
    expect(await skipSync({ ...args, doc: { publishedIn: ['en'] }, locale: 'en' })).toBe(false)
    expect(await skipSync({ ...args, doc: { publishedIn: ['en'] }, locale: 'fr' })).toBe(true)
  })
})
