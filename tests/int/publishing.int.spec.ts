import { createLocalTransport, getPayload, handleV1 } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import { PIPELINE_SAVE, recomputeAll, setTagRefresher } from '@promisetracker/plugin-core'
import { createSdk } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Publishing rules and the cascade (section 8), with a fictional actor and
 * claims in a small country no one tracks. The worker never polls in the
 * tests: the cascade runs because the save starts it.
 */
describe('publishing rules and the cascade', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let actor: string
  let topic: string
  const claims: Record<string, string> = {}
  const refreshed: string[][] = []
  const sdk = createSdk(createLocalTransport())
  const mailpit = `http://localhost:${process.env.PT_MAIL_UI_PORT || '8025'}/api/v1`

  const v1 = (route: string, locale = 'en') =>
    handleV1(payload, route, new URLSearchParams({ locale }))
  const listed = async (locale = 'en') =>
    (await sdk.getClaims(locale, code)).items.map((c) => c.slug).sort()
  const publishedIn = async (collection: 'claims' | 'actors' | 'countries', id: string) =>
    (await payload.findByID({ collection, id, overrideAccess: true, trash: true })).publishedIn
  const setStatus = (
    collection: 'claims' | 'actors' | 'countries',
    id: string,
    recordStatus: 'ready' | 'hold' | 'archived',
  ) => payload.update({ collection, id, data: { recordStatus }, overrideAccess: true })
  const claim = async (slug: string, extra: Record<string, unknown> = {}) => {
    const doc = await payload.create({
      collection: 'claims',
      locale: 'en',
      data: {
        title: `A pledge, ${slug}`,
        slug,
        actor,
        topic,
        sourceUrl: 'https://example.org/manifesto',
        recordStatus: 'ready',
        ...extra,
      },
      overrideAccess: true,
    })
    claims[slug] = doc.id
    return doc
  }
  const emailsWith = async (subject: string) => {
    const res = await fetch(`${mailpit}/search?query=${encodeURIComponent(`subject:"${subject}"`)}`)
    const body = (await res.json()) as { messages?: { Subject: string }[] }
    return body.messages ?? []
  }

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async (tags) => {
      refreshed.push([...tags])
    })
    ;[code = 'gw'] = await unusedCountryCodes(payload, 1)
    // Test set-up writes as the system.
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    const office = await payload.create({
      collection: 'offices',
      locale: 'en',
      data: { name: 'President', areaType: 'country', holdersPerSeat: 1, order: 1, country },
      overrideAccess: true,
    })
    actor = (
      await payload.create({
        collection: 'actors',
        data: { name: 'Neema Odhiambo', kind: 'person', country, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    await payload.create({
      collection: 'terms',
      data: { actor, office: office.id, startsOn: '2022-09-13T12:00:00.000Z' },
      overrideAccess: true,
    })
    topic = (
      await payload.create({
        collection: 'topics',
        locale: 'en',
        data: { name: 'Publishing test topic' },
        overrideAccess: true,
      })
    ).id
    await claim('roads')
    await claim('water')
    await claim('schools')
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
    await payload.delete({ collection: 'topics', id: topic, overrideAccess: true })
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
  })

  it('publishes a ready claim with its checks met, in the languages its parents are in', async () => {
    expect(await publishedIn('claims', claims.roads ?? '')).toEqual(['en'])
    expect(await listed()).toEqual(['roads', 'schools', 'water'])
  })

  it('says why a claim is not public, and publishes it once the reason is fixed', async () => {
    const doc = await claim('clinics', { topic: null, sourceUrl: null })
    expect(doc.publishedIn).toEqual([])
    expect(doc.publishingProblems).toBe(
      'It needs a topic.\nIt needs a source: a link to where it was said, or a document.',
    )
    const fixed = await payload.update({
      collection: 'claims',
      id: doc.id,
      data: { topic, sourceUrl: 'https://example.org/clinics' },
      overrideAccess: true,
    })
    expect(fixed.publishedIn).toEqual(['en'])
    expect(fixed.publishingProblems).toBeNull()
  })

  it('says a claim live in English is not available in French', async () => {
    expect(await v1(`/countries/${code}/claims/roads`, 'fr')).toMatchObject({
      status: 404,
      body: { error: 'not-available', availableIn: [{ code: 'en' }] },
    })
  })

  it('publishes a language only when Payload has published it, not when it is a draft', async () => {
    const id = claims.roads ?? ''
    // The country has French. The claim gets a French title as a draft.
    await payload.update({
      collection: 'claims',
      id,
      locale: 'fr',
      draft: true,
      data: { title: 'Un engagement, routes' },
      overrideAccess: true,
    })
    expect(await publishedIn('claims', id)).toEqual(['en'])
    await payload.update({
      collection: 'claims',
      id,
      locale: 'fr',
      data: { title: 'Un engagement, routes', _status: 'published' },
      overrideAccess: true,
    })
    expect(await publishedIn('claims', id)).toEqual(['en', 'fr'])
    expect(await listed('fr')).toEqual(['roads'])
  })

  it('holds a claim on its own', async () => {
    await setStatus('claims', claims.water ?? '', 'hold')
    expect(await listed()).toEqual(['clinics', 'roads', 'schools'])
  })

  it('hides every claim when the country is held, and brings back only those not held on their own', async () => {
    refreshed.length = 0
    await setStatus('countries', country, 'hold')
    // The cascade has run by the time the save returns: the save started it at once.
    expect(await publishedIn('actors', actor)).toEqual([])
    for (const id of Object.values(claims)) expect(await publishedIn('claims', id)).toEqual([])
    expect(await v1(`/countries/${code}/claims`)).toMatchObject({ status: 404 })
    expect(refreshed.some((tags) => tags.includes(`claims:${code}`))).toBe(true)

    await setStatus('countries', country, 'ready')
    expect(await listed()).toEqual(['clinics', 'roads', 'schools'])
    expect(await publishedIn('claims', claims.water ?? '')).toEqual([])
  })

  it('takes an actor’s claims off the API within seconds when the actor is held', async () => {
    const started = Date.now()
    await setStatus('actors', actor, 'hold')
    expect(await listed()).toEqual([])
    expect(Date.now() - started).toBeLessThan(5000)
    await setStatus('actors', actor, 'ready')
    expect(await listed()).toEqual(['clinics', 'roads', 'schools'])
  })

  it('takes a document’s claims off the API within seconds when the document is held', async () => {
    // Saved as the pipeline does, so the link is not fetched in the test.
    const document = await payload.create({
      collection: 'documents',
      data: {
        title: 'A fictional manifesto',
        country,
        connector: 'url',
        sourceUrl: 'https://example.org/manifesto.pdf',
        recordStatus: 'ready',
      },
      overrideAccess: true,
      context: { [PIPELINE_SAVE]: true },
    })
    expect(document.publishedIn).toEqual(['en', 'fr', 'pt', 'ar', 'sw'])
    await payload.update({
      collection: 'claims',
      id: claims.roads ?? '',
      data: { source: document.id },
      overrideAccess: true,
    })
    const started = Date.now()
    await payload.update({
      collection: 'documents',
      id: document.id,
      data: { recordStatus: 'hold' },
      overrideAccess: true,
      context: { [PIPELINE_SAVE]: true },
    })
    expect(await listed()).toEqual(['clinics', 'schools'])
    expect(Date.now() - started).toBeLessThan(5000)
    await payload.update({
      collection: 'documents',
      id: document.id,
      data: { recordStatus: 'ready' },
      overrideAccess: true,
      context: { [PIPELINE_SAVE]: true },
    })
    expect(await listed()).toEqual(['clinics', 'roads', 'schools'])
    await payload.update({
      collection: 'claims',
      id: claims.roads ?? '',
      data: { source: null },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'documents', id: document.id, overrideAccess: true })
  })

  it('moves a deleted record to the trash, where it is live nowhere and can be restored', async () => {
    const id = claims.schools ?? ''
    await payload.update({
      collection: 'claims',
      id,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: true,
      trash: true,
    })
    expect(await publishedIn('claims', id)).toEqual([])
    expect(await listed()).toEqual(['clinics', 'roads'])
    await payload.update({
      collection: 'claims',
      id,
      data: { deletedAt: null },
      overrideAccess: true,
      trash: true,
    })
    expect(await listed()).toEqual(['clinics', 'roads', 'schools'])
  })

  it('lets an editor trash a record, and only a super-admin delete one for good', async () => {
    const user = (role: 'editor' | 'super-admin') =>
      payload.create({
        collection: 'users',
        data: {
          email: `${role}-${code}@example.org`,
          password: 'a-test-password-only',
          name: `Trash test ${role}`,
          roles: [role],
        },
        overrideAccess: true,
      })
    const editorDoc = await user('editor')
    const ownerDoc = await user('super-admin')
    const editor = { ...editorDoc, collection: 'users' } as never
    const owner = { ...ownerDoc, collection: 'users' } as never
    const doc = await claim('bridges')
    await expect(
      payload.delete({ collection: 'claims', id: doc.id, overrideAccess: false, user: editor }),
    ).rejects.toThrow()
    await payload.update({
      collection: 'claims',
      id: doc.id,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: false,
      user: editor,
      trash: true,
    })
    await payload.delete({
      collection: 'claims',
      id: doc.id,
      overrideAccess: false,
      user: owner,
      trash: true,
    })
    const left = await payload.find({
      collection: 'claims',
      where: { id: { equals: doc.id } },
      overrideAccess: true,
      trash: true,
    })
    expect(left.docs).toEqual([])
    delete claims.bridges
    await payload.delete({
      collection: 'users',
      where: { id: { in: [editorDoc.id, ownerDoc.id] } },
      overrideAccess: true,
    })
  })

  it('emails editors when a record is archived or restored, and when a country is held', async () => {
    const editor = await payload.create({
      collection: 'users',
      data: {
        email: `publishing-${code}@example.org`,
        password: 'a-test-password-only',
        name: 'Publishing test editor',
        roles: ['editor'],
      },
      overrideAccess: true,
    })
    try {
      await setStatus('claims', claims.roads ?? '', 'archived')
      await setStatus('claims', claims.roads ?? '', 'ready')
      await setStatus('countries', country, 'hold')
      await setStatus('countries', country, 'ready')
      expect(await emailsWith('Archived: A pledge, roads')).not.toEqual([])
      expect(await emailsWith('Restored: A pledge, roads')).not.toEqual([])
      expect(await emailsWith(`Country on hold:`)).not.toEqual([])
    } finally {
      await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true })
    }
  })

  it('works out every record again on request, as after a change to the languages', async () => {
    const id = claims.roads ?? ''
    // As if the rules had changed since it was saved.
    await payload.db.updateOne({ collection: 'claims', id, data: { publishedIn: [] } })
    expect(await publishedIn('claims', id)).toEqual([])
    const result = await recomputeAll(payload, ['claims'])
    expect(result.claims?.changed).toBeGreaterThanOrEqual(1)
    expect(await publishedIn('claims', id)).toEqual(['en', 'fr'])
  })
})
