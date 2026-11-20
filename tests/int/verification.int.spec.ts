import { createLocalTransport, getPayload } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import { AWAITING_VERIFICATION, VERIFICATION_QUEUE } from '@promisetracker/plugin-core'
import { createSdk } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Built-in verification (sections 5.1, 7.5 and 13), with a fictional actor
 * and claims in a small country no one tracks.
 */
describe('built-in verification', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let actor: string
  let topic: string
  let roads = ''
  const users: Record<'contributor' | 'reviewer', { id: string }> = {
    contributor: { id: '' },
    reviewer: { id: '' },
  }
  const sdk = createSdk(createLocalTransport())
  const as = (role: keyof typeof users) => ({ ...users[role], collection: 'users' }) as never

  const claim = (slug: string, extra: Record<string, unknown> = {}) =>
    payload.create({
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
  const verify = (id: string, verdict: string, rationale?: string) =>
    payload.update({
      collection: 'claims',
      id,
      locale: 'en',
      data: { verification: { verdict, ...(rationale ? { rationale } : {}) } } as never,
      overrideAccess: false,
      user: as('reviewer'),
    })

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'dj'] = await unusedCountryCodes(payload, 1)
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
        data: { name: 'Rehema Achieng', kind: 'person', country, recordStatus: 'ready' },
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
        data: { name: 'Verification test topic' },
        overrideAccess: true,
      })
    ).id
    for (const role of ['contributor', 'reviewer'] as const) {
      users[role] = await payload.create({
        collection: 'users',
        data: {
          email: `${role}-verify-${code}@example.org`,
          password: 'a-test-password-only',
          name: `Verification test ${role}`,
          roles: [role],
        },
        overrideAccess: true,
      })
    }
  })

  afterAll(async () => {
    // Claims found false are never deleted by hand, so the test clears their verdicts first.
    await payload.update({
      collection: 'claims',
      where: { country: { equals: country } },
      data: { verification: { verdict: 'unverified' } } as never,
      overrideAccess: true,
    })
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
    await payload.delete({
      collection: 'users',
      where: { id: { in: [users.contributor.id, users.reviewer.id] } },
      overrideAccess: true,
    })
  })

  it('keeps a claim unpublished until it is verified, and says so', async () => {
    const doc = await claim('roads')
    roads = doc.id
    expect(doc.publishedIn).toEqual([])
    expect(doc.publishingProblems).toBe('It is not verified yet.')
    const verified = await verify(doc.id, 'verified', 'Checked against the manifesto.')
    expect(verified.publishedIn).toEqual(['en'])
  })

  it('records when and by whom a verdict was set', async () => {
    const doc = await payload.findByID({ collection: 'claims', id: roads, overrideAccess: true })
    expect(doc.verification?.verdict).toBe('verified')
    expect(doc.verification?.date?.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    const by = doc.verification?.verifiedBy
    expect(typeof by === 'object' ? by?.id : by).toBe(users.reviewer.id)
  })

  it('dates each new verdict, even when the form sends back the old date', async () => {
    const doc = await claim('bridges')
    const set = (verdict: string, date?: string) =>
      payload.update({
        collection: 'claims',
        id: doc.id,
        data: { verification: { verdict, ...(date ? { date } : {}) } } as never,
        overrideAccess: false,
        user: as('reviewer'),
      })
    // A date chosen on purpose is kept.
    const first = await set('verified', '2026-01-15T12:00:00.000Z')
    expect(first.verification?.date?.slice(0, 10)).toBe('2026-01-15')
    // The admin sends the whole group back, old date and all. A new verdict gets today.
    const second = await set('misleading', first.verification?.date ?? undefined)
    expect(second.verification?.date?.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10))
    // A cleared verdict is unverified, so the claim is back in the queue.
    const cleared = await payload.update({
      collection: 'claims',
      id: doc.id,
      data: { verification: { verdict: null } } as never,
      overrideAccess: true,
    })
    expect(cleared.verification?.verdict).toBe('unverified')
  })

  it('refuses a reviewer moving a claim to the trash', async () => {
    const doc = await claim('ferries')
    // Trashing needs the right to delete, which a reviewer does not have.
    await expect(
      payload.update({
        collection: 'claims',
        id: doc.id,
        data: { deletedAt: new Date().toISOString(), verification: { verdict: 'verified' } },
        overrideAccess: false,
        user: as('reviewer'),
        trash: true,
      }),
    ).rejects.toThrow()
    const after = await payload.findByID({
      collection: 'claims',
      id: doc.id,
      overrideAccess: true,
      trash: true,
    })
    expect(after.deletedAt ?? null).toBeNull()
  })

  it('lets only reviewers, editors and super-admins set a verdict', async () => {
    const doc = await payload.create({
      collection: 'claims',
      locale: 'en',
      data: {
        title: 'A pledge, water',
        slug: 'water',
        actor,
        topic,
        sourceUrl: 'https://example.org/manifesto',
        recordStatus: 'hold',
        verification: { verdict: 'verified' },
      },
      overrideAccess: false,
      user: as('contributor'),
    })
    // The field is closed to a contributor, so the verdict they sent is ignored.
    expect(doc.verification?.verdict).toBe('unverified')
    // A reviewer sets the verdict, and nothing else they send changes.
    const reviewed = await payload.update({
      collection: 'claims',
      id: doc.id,
      locale: 'en',
      data: { title: 'A different title', verification: { verdict: 'verified' } },
      overrideAccess: false,
      user: as('reviewer'),
    })
    expect(reviewed.verification?.verdict).toBe('verified')
    expect(reviewed.title).toBe('A pledge, water')
    await payload.update({
      collection: 'claims',
      id: doc.id,
      data: { verification: { verdict: 'unverified' } } as never,
      overrideAccess: true,
    })
  })

  it('never publishes a claim found false or misleading, and never deletes it', async () => {
    const doc = await claim('schools')
    await verify(doc.id, 'verified')
    const found = await verify(doc.id, 'false', 'The minister said the opposite.')
    expect(found.publishedIn).toEqual([])
    expect(found.publishingProblems).toBe('It was found false. Such claims are never published.')
    await expect(
      payload.delete({ collection: 'claims', id: doc.id, overrideAccess: true }),
    ).rejects.toThrow('never deleted')
    await expect(
      payload.update({
        collection: 'claims',
        id: doc.id,
        data: { deletedAt: new Date().toISOString() },
        overrideAccess: true,
        trash: true,
      }),
    ).rejects.toThrow('never deleted')
    // Archiving is the way to put it away.
    const archived = await payload.update({
      collection: 'claims',
      id: doc.id,
      data: { recordStatus: 'archived' },
      overrideAccess: true,
    })
    expect(archived.recordStatus).toBe('archived')
  })

  it('shows the verdict’s date and rationale on the claim, and never who verified it', async () => {
    const shown = await sdk.getClaim('en', code, 'roads')
    expect(shown).toMatchObject({
      verification: {
        date: new Date().toISOString().slice(0, 10),
        rationale: 'Checked against the manifesto.',
        reportUrl: null,
      },
    })
    expect(JSON.stringify(shown)).not.toContain(users.reviewer.id)
    // Nor through Payload's own routes, as a guest reads them.
    const { docs } = await payload.find({
      collection: 'claims',
      where: { slug: { equals: 'roads' } },
      overrideAccess: false,
    })
    expect(docs[0]?.verification?.verifiedBy).toBeUndefined()
  })

  it('lists claims awaiting verification in a shared saved view', async () => {
    const presets = await payload.find({
      collection: 'payload-query-presets',
      where: { title: { equals: VERIFICATION_QUEUE } },
      overrideAccess: true,
    })
    expect(presets.docs[0]).toMatchObject({ relatedCollection: 'claims', isShared: true })
    const waiting = await payload.find({
      collection: 'claims',
      where: { and: [{ country: { equals: country } }, AWAITING_VERIFICATION] },
      overrideAccess: true,
    })
    expect(waiting.docs.map((d) => d.slug).sort()).toEqual(['bridges', 'ferries', 'water'])
  })
})
