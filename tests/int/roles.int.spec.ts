import { getPayload } from '@promisetracker/cms'
import type { Role } from '@promisetracker/plugin-core'
import { ROLES } from '@promisetracker/plugin-core'
import type { Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Roles against a real database (section 13.2): what each role can and cannot
 * do to users and site settings, sign-in limits, and what a guest can see.
 */
describe('users, roles and access', () => {
  let payload: Payload
  // A signed-in user as a request carries it, which is what the Local API's `user` takes.
  type User = NonNullable<PayloadRequest['user']> & { email: string }
  const users = new Map<Role, User>()
  const created: string[] = []
  const password = `pw-${crypto.randomUUID()}`
  const email = (label: string) => `${label}-${crypto.randomUUID()}@example.org`

  const make = async (roles: Role[], label = roles.join('-')): Promise<User> => {
    const user = await payload.create({
      collection: 'users',
      data: { email: email(label), password, name: label, roles },
      // Test set-up writes as the system. The tests below act as each user.
      overrideAccess: true,
    })
    created.push(user.id)
    return { ...user, collection: 'users' } as User
  }
  const user = (role: Role): User => {
    const found = users.get(role)
    if (!found) throw new Error(`no ${role}`)
    return found
  }

  beforeAll(async () => {
    payload = await getPayload()
    for (const role of ROLES) users.set(role, await make([role]))
  })

  afterAll(async () => {
    for (const id of created) {
      await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => {})
    }
    await payload.updateGlobal({ slug: 'site', data: { tagline: null }, overrideAccess: true })
    await payload.destroy()
  })

  describe('managing users', () => {
    it('lets only a super-admin create a user', async () => {
      const data = { email: email('new'), password, roles: ['viewer' as const] }
      for (const role of ROLES.filter((r) => r !== 'super-admin')) {
        await expect(
          payload.create({ collection: 'users', data, user: user(role), overrideAccess: false }),
        ).rejects.toThrow()
      }
      const made = await payload.create({
        collection: 'users',
        data,
        user: user('super-admin'),
        overrideAccess: false,
      })
      created.push(made.id)
      expect(made.roles).toEqual(['viewer'])
    })

    it('lets a user change their own name, and nobody else’s', async () => {
      const editor = user('editor')
      const own = await payload.update({
        collection: 'users',
        id: editor.id,
        data: { name: 'Renamed' },
        user: editor,
        overrideAccess: false,
      })
      expect(own.name).toBe('Renamed')
      await expect(
        payload.update({
          collection: 'users',
          id: user('viewer').id,
          data: { name: 'Not mine' },
          user: editor,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('does not let a user give themselves a role', async () => {
      const contributor = user('contributor')
      const result = await payload.update({
        collection: 'users',
        id: contributor.id,
        data: { roles: ['super-admin'], countries: ['ke'] },
        user: contributor,
        overrideAccess: false,
      })
      expect(result.roles).toEqual(['contributor'])
      expect(result.countries ?? []).toEqual([])
    })

    it('lets a super-admin set roles and the country list, more than one of each', async () => {
      const target = await make(['viewer'], 'promoted')
      const result = await payload.update({
        collection: 'users',
        id: target.id,
        data: { roles: ['editor', 'moderator'], countries: ['ke', 'sn'] },
        user: user('super-admin'),
        overrideAccess: false,
      })
      expect(result.roles).toEqual(['editor', 'moderator'])
      expect(result.countries).toEqual(['ke', 'sn'])
    })

    it('refuses a country that is not a two-letter code', async () => {
      await expect(
        payload.update({
          collection: 'users',
          id: user('viewer').id,
          data: { countries: ['Kenya'] },
          user: user('super-admin'),
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('lets a super-admin reset another user’s password', async () => {
      const target = await make(['viewer'], 'reset')
      const next = `new-${crypto.randomUUID()}`
      await payload.update({
        collection: 'users',
        id: target.id,
        data: { password: next },
        user: user('super-admin'),
        overrideAccess: false,
      })
      const session = await payload.login({
        collection: 'users',
        data: { email: target.email, password: next },
      })
      expect(session.user?.id).toBe(target.id)
      await expect(
        payload.login({ collection: 'users', data: { email: target.email, password } }),
      ).rejects.toThrow()
    })

    it('lets a super-admin be demoted or deleted while another one remains', async () => {
      // The "last super-admin" rule counts the others in the database. Here there
      // are others, so both changes go through.
      const second = await make(['super-admin'], 'second-admin')
      const demoted = await payload.update({
        collection: 'users',
        id: second.id,
        data: { roles: ['viewer'] },
        user: user('super-admin'),
        overrideAccess: false,
      })
      expect(demoted.roles).toEqual(['viewer'])

      const third = await make(['super-admin'], 'third-admin')
      await payload.delete({
        collection: 'users',
        id: third.id,
        user: user('super-admin'),
        overrideAccess: false,
      })
    })

    it('lets only a super-admin delete a user', async () => {
      const target = await make(['viewer'], 'removed')
      await expect(
        payload.delete({
          collection: 'users',
          id: target.id,
          user: user('editor'),
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      await payload.delete({
        collection: 'users',
        id: target.id,
        user: user('super-admin'),
        overrideAccess: false,
      })
    })
  })

  describe('signing in', () => {
    it('puts the roles in the session, and gives a refresh token', async () => {
      const editor = user('editor')
      const session = await payload.login({
        collection: 'users',
        data: { email: editor.email, password },
      })
      expect(session.user?.roles).toEqual(['editor'])
      expect(session.token).toBeTypeOf('string')
      expect(session).toHaveProperty('refreshToken')
    })

    it('applies a change of roles on the next request, not at the next sign-in', async () => {
      const target = await make(['editor'], 'demoted')
      const { token } = await payload.login({
        collection: 'users',
        data: { email: target.email, password },
      })
      const whoAmI = () => payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
      expect((await whoAmI()).user?.roles).toEqual(['editor'])

      await payload.update({
        collection: 'users',
        id: target.id,
        data: { roles: ['viewer'] },
        user: user('super-admin'),
        overrideAccess: false,
      })
      // The same token, issued while the user was an editor.
      expect((await whoAmI()).user?.roles).toEqual(['viewer'])
    })

    it('locks the account after five wrong passwords', async () => {
      const target = await make(['viewer'], 'locked')
      const login = (pw: string) =>
        payload.login({ collection: 'users', data: { email: target.email, password: pw } })
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(login('wrong-password')).rejects.toThrow()
      }
      // The right password no longer works until the lock runs out.
      await expect(login(password)).rejects.toThrow()
    })
  })

  describe('site settings', () => {
    it('lets an editor change them, and no other role but a super-admin', async () => {
      for (const role of ROLES) {
        const attempt = payload.updateGlobal({
          slug: 'site',
          data: { tagline: `Set by ${role}` },
          user: user(role),
          overrideAccess: false,
        })
        if (role === 'super-admin' || role === 'editor') {
          await expect(attempt).resolves.toMatchObject({ tagline: `Set by ${role}` })
        } else {
          await expect(attempt).rejects.toThrow()
        }
      }
    })
  })

  describe('a guest', () => {
    it('cannot read users', async () => {
      await expect(payload.find({ collection: 'users', overrideAccess: false })).rejects.toThrow()
    })

    it('cannot see who created or changed a record that guests can read', async () => {
      await payload.updateGlobal({
        slug: 'site',
        data: { tagline: 'Changed by an editor' },
        user: user('editor'),
        overrideAccess: false,
      })
      const asGuest = await payload.findGlobal({ slug: 'site', overrideAccess: false })
      expect(asGuest.tagline).toBe('Changed by an editor')
      expect(asGuest).not.toHaveProperty('updatedBy')
      expect(asGuest).not.toHaveProperty('createdBy')

      const asStaff = await payload.findGlobal({
        slug: 'site',
        user: user('viewer'),
        overrideAccess: false,
      })
      expect(asStaff.updatedBy).toBeTruthy()
    })

    it('cannot read version history or authorship on any record type or global', async () => {
      const guest = { req: { user: null, payload } } as never
      // Payload's own internal record types (preferences, jobs, migrations) are
      // closed to guests by Payload itself and are not part of the content.
      const entities = [...payload.config.collections, ...payload.config.globals].filter(
        (entity) => !entity.slug.startsWith('payload-'),
      )
      expect(entities.map((e) => e.slug)).toEqual(
        expect.arrayContaining(['users', 'media', 'site']),
      )
      for (const entity of entities) {
        expect(await entity.access.readVersions(guest), `${entity.slug} versions`).toBe(false)
        for (const name of ['createdBy', 'updatedBy']) {
          const field = entity.fields.find((f) => 'name' in f && f.name === name)
          if (!field) continue
          const read = 'access' in field ? field.access?.read : undefined
          expect(read, `${entity.slug}.${name} has a read rule`).toBeTypeOf('function')
          expect(await read?.(guest), `${entity.slug}.${name}`).toBe(false)
        }
      }
    })
  })
})
