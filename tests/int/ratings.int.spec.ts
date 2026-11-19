import { getPayload, handleV1 } from '@promisetracker/cms'
import { SiteInfo } from '@promisetracker/contract'
import {
  DELIVERY_SCALE,
  ensureDefaultRatings,
  setRatingUsage,
  setTagRefresher,
} from '@promisetracker/plugin-core'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Rating scales and claim types against a real database (section 7.4, D22):
 * what the migration adds, what the API returns, and the rules that keep
 * ratings safe to change. Tests make their own scale and leave the default
 * one as start-up made it.
 */
describe('rating scales and claim types', () => {
  let payload: Payload
  const created: { collection: 'rating-scales' | 'claim-types'; id: string }[] = []
  type User = NonNullable<PayloadRequest['user']>
  const users: Record<'super-admin' | 'editor', User | null> = { 'super-admin': null, editor: null }
  const as = (role: keyof typeof users): User => {
    const user = users[role]
    if (!user) throw new Error(`no ${role}`)
    return user
  }

  /** Why a save was refused: the message, and each field's own message. */
  const refusal = async (attempt: Promise<unknown>): Promise<string> => {
    const error: unknown = await attempt.then(
      () => null,
      (e: unknown) => e,
    )
    if (!(error instanceof Error)) throw new Error('The save was not refused.')
    const data = Reflect.get(error, 'data') as { errors?: { message: string }[] } | undefined
    return [error.message, ...(data?.errors ?? []).map((e) => e.message)].join(' ')
  }

  const site = async (locale: string) => {
    const res = await handleV1(payload, '/site', new URLSearchParams({ locale }))
    expect(res?.status).toBe(200)
    return SiteInfo.parse(res?.body)
  }

  /** A small scale of the test's own. */
  const makeScale = async () => {
    const doc = await payload.create({
      collection: 'rating-scales',
      locale: 'en',
      data: {
        name: `Test scale ${crypto.randomUUID()}`,
        bestValue: 1,
        worstValue: 0,
        tiers: [{ slug: 'all', label: 'All', colour: '#16181c' }],
        ratings: [
          {
            slug: 'open',
            label: 'Open',
            definition: 'Not decided.',
            tier: 'all',
            colour: '#e4e5e8',
            textColour: '#2a2c26',
            value: 0,
            isStarting: true,
          },
          {
            slug: 'done',
            label: 'Done',
            definition: 'Finished.',
            tier: 'all',
            colour: '#1b4fd8',
            textColour: '#ffffff',
            value: 1,
          },
        ],
      },
      // Test set-up writes as the system.
      overrideAccess: true,
    })
    created.push({ collection: 'rating-scales', id: doc.id })
    return doc
  }

  beforeAll(async () => {
    payload = await getPayload()
    // No site to refresh in these tests.
    setTagRefresher(async () => {})
    for (const role of ['super-admin', 'editor'] as const) {
      const user = await payload.create({
        collection: 'users',
        data: {
          email: `${role}-${crypto.randomUUID()}@example.org`,
          password: `pw-${crypto.randomUUID()}`,
          name: role,
          roles: [role],
        },
        // Test set-up writes as the system.
        overrideAccess: true,
      })
      users[role] = { ...user, collection: 'users' } as User
    }
  })

  afterAll(async () => {
    setRatingUsage(async () => [])
    for (const { collection, id } of created.reverse()) {
      await payload.delete({ collection, id, overrideAccess: true }).catch(() => {})
    }
    for (const user of Object.values(users)) {
      // The last super-admin cannot be deleted. In a fresh test database that is
      // this one, which goes when the database does.
      if (user) {
        await payload
          .delete({ collection: 'users', id: user.id, overrideAccess: true })
          .catch(() => {})
      }
    }
    await payload.destroy()
  })

  describe('what a new installation has', () => {
    it('has the Delivery scale, in English and French', async () => {
      const { docs } = await payload.find({
        collection: 'rating-scales',
        where: { 'ratings.slug': { equals: 'unstarted' } },
        locale: 'all',
        depth: 0,
        overrideAccess: true,
      })
      expect(docs).toHaveLength(1)
      const [scale] = docs as unknown as {
        name: Record<string, string>
        ratings: {
          slug: string
          label: Record<string, string>
          definition: Record<string, string>
        }[]
      }[]
      expect(scale?.name).toMatchObject({ en: 'Delivery', fr: 'Réalisation' })
      expect(scale?.ratings.map((r) => r.slug)).toEqual(DELIVERY_SCALE.ratings.map((r) => r.slug))
      for (const [i, r] of DELIVERY_SCALE.ratings.entries()) {
        expect(scale?.ratings[i]?.label).toMatchObject(r.label)
        expect(scale?.ratings[i]?.definition).toMatchObject(r.definition)
      }
    })

    it('adds the defaults once, however often it starts', async () => {
      const count = async () => ({
        scales: (await payload.count({ collection: 'rating-scales', overrideAccess: true }))
          .totalDocs,
        types: (await payload.count({ collection: 'claim-types', overrideAccess: true })).totalDocs,
      })
      const before = await count()
      // Start-up runs again, in the web process and the worker together.
      await Promise.all([ensureDefaultRatings(payload), ensureDefaultRatings(payload)])
      expect(await count()).toEqual(before)
    })

    it('has the Promise claim type, using the Delivery scale', async () => {
      const { docs } = await payload.find({
        collection: 'claim-types',
        where: { slug: { equals: 'promise' } },
        locale: 'all',
        depth: 1,
        overrideAccess: true,
      })
      const [type] = docs as unknown as {
        name: Record<string, string>
        hasDeadline: boolean
        ratingScale: { name: Record<string, string> }
      }[]
      expect(type?.name).toEqual({ en: 'Promise', fr: 'Promesse' })
      expect(type?.ratingScale.name.en).toBe('Delivery')
    })
  })

  describe('GET /api/v1/site', () => {
    it('returns every scale with its tiers and ratings, in the language asked for', async () => {
      const [en, fr] = [await site('en'), await site('fr')]
      const delivery = en.ratingScales.find((s) => s.name === 'Delivery')
      expect(delivery?.tiers.map((t) => t.label)).toEqual([
        'Promise kept',
        'Uncertain',
        'Promise not kept',
      ])
      expect(delivery?.ratings.find((r) => r.isStarting)?.label).toBe('Unstarted')
      expect(delivery?.ratings.find((r) => r.slug === 'stalled')).toMatchObject({
        needsDeadline: true,
        value: 1,
        colour: '#c93b2c',
        textColour: '#ffffff',
        retired: false,
      })
      const delivered = fr.ratingScales.find((s) => s.id === delivery?.id)
      expect(delivered?.name).toBe('Réalisation')
      expect(delivered?.ratings.map((r) => r.label)).toContain('Bloquée')
    })
  })

  describe('changing ratings', () => {
    it('keeps every change to a definition in the version history', async () => {
      const scale = await makeScale()
      const ratings = (scale.ratings ?? []).map((r) =>
        r.slug === 'done' ? { ...r, definition: 'Finished in full.' } : r,
      )
      await payload.update({
        collection: 'rating-scales',
        id: scale.id,
        locale: 'en',
        data: { ratings },
        overrideAccess: true,
      })
      const versions = await payload.findVersions({
        collection: 'rating-scales',
        where: { parent: { equals: scale.id } },
        sort: 'createdAt',
        locale: 'en',
        overrideAccess: true,
      })
      const definitions = versions.docs.map(
        (v) => v.version.ratings?.find((r) => r.slug === 'done')?.definition,
      )
      expect(definitions).toEqual(['Finished.', 'Finished in full.'])
    })

    it('never changes a saved rating’s slug', async () => {
      const scale = await makeScale()
      const ratings = (scale.ratings ?? []).map((r) =>
        r.slug === 'done' ? { ...r, slug: 'finished' } : r,
      )
      expect(
        await refusal(
          payload.update({
            collection: 'rating-scales',
            id: scale.id,
            data: { ratings },
            overrideAccess: true,
          }),
        ),
      ).toMatch(/never changes/)
    })

    it('refuses to delete a rating claims carry, and lists the claims of a retired one', async () => {
      const scale = await makeScale()
      setRatingUsage(async ({ scale: id, rating }) =>
        id === scale.id && rating === 'done' ? [{ id: 'c1', title: 'Build 100 schools' }] : [],
      )
      const withoutDone = (scale.ratings ?? []).filter((r) => r.slug !== 'done')
      expect(
        await refusal(
          payload.update({
            collection: 'rating-scales',
            id: scale.id,
            data: { ratings: withoutDone },
            overrideAccess: true,
          }),
        ),
      ).toMatch(/Build 100 schools/)

      const retired = (scale.ratings ?? []).map((r) =>
        r.slug === 'done' ? { ...r, retired: true } : r,
      )
      await payload.update({
        collection: 'rating-scales',
        id: scale.id,
        data: { ratings: retired },
        overrideAccess: true,
      })
      const read = await payload.findByID({
        collection: 'rating-scales',
        id: scale.id,
        user: as('super-admin'),
        overrideAccess: true,
      })
      expect(read.ratings?.find((r) => r.slug === 'done')?.claimsWithRating).toBe(
        'Build 100 schools (c1)',
      )

      // A guest never sees which claims carry it.
      const asGuest = await payload.findByID({
        collection: 'rating-scales',
        id: scale.id,
        overrideAccess: false,
      })
      expect(asGuest.ratings?.find((r) => r.slug === 'done')?.claimsWithRating ?? null).toBeNull()

      expect(
        await refusal(
          payload.delete({ collection: 'rating-scales', id: scale.id, overrideAccess: true }),
        ),
      ).toMatch(/Build 100 schools/)
      setRatingUsage(async () => [])
    })

    it('refuses to delete a scale a claim type uses', async () => {
      const scale = await makeScale()
      const type = await payload.create({
        collection: 'claim-types',
        locale: 'en',
        data: {
          name: 'Test type',
          slug: `test-${crypto.randomUUID().slice(0, 8)}`,
          ratingScale: scale.id,
        },
        overrideAccess: true,
      })
      created.push({ collection: 'claim-types', id: type.id })
      expect(
        await refusal(
          payload.delete({ collection: 'rating-scales', id: scale.id, overrideAccess: true }),
        ),
      ).toMatch(/Test type/)
    })

    it('lets only a super-admin change a scale', async () => {
      const scale = await makeScale()
      await expect(
        payload.update({
          collection: 'rating-scales',
          id: scale.id,
          data: { name: 'Mine' },
          user: as('editor'),
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      const changed = await payload.update({
        collection: 'rating-scales',
        id: scale.id,
        locale: 'en',
        data: { name: 'Renamed' },
        user: as('super-admin'),
        overrideAccess: false,
      })
      expect(changed.name).toBe('Renamed')
    })
  })
})
