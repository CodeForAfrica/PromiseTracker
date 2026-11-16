import { readFileSync } from 'node:fs'
import path from 'node:path'

import { effectiveMethod, ensureFirstAdmin, guestMayCall } from '@promisetracker/cms'
import type { Role } from '@promisetracker/plugin-core'
import {
  access,
  can,
  hasRole,
  maySetRecordStatus,
  privateHistory,
  ROLES,
  rolesOf,
  signedIn,
  Users,
  userCan,
} from '@promisetracker/plugin-core'
import type { Config, Field, Payload, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

const as = (...roles: Role[]) => ({
  req: { user: { id: 'u1', roles } } as unknown as PayloadRequest,
})
const guest = { req: { user: null } as unknown as PayloadRequest }

describe('roles', () => {
  it('reads the roles a user holds, and none for a guest', () => {
    expect(rolesOf({ roles: ['editor', 'moderator'] } as never)).toEqual(['editor', 'moderator'])
    expect(rolesOf(null)).toEqual([])
    expect(rolesOf({ roles: ['made-up'] } as never)).toEqual([])
  })

  it('lets a user hold more than one role', () => {
    const user = { roles: ['contributor', 'moderator'] } as never
    expect(hasRole(user, 'moderator')).toBe(true)
    expect(hasRole(user, 'editor')).toBe(false)
  })
})

describe('the permission matrix in section 13.2', () => {
  // One line per row of the matrix: the rule, then the roles that may.
  const matrix: [keyof typeof can, Role[]][] = [
    ['manageStructure', ['super-admin']],
    ['manageRatings', ['super-admin']],
    ['manageUsers', ['super-admin']],
    ['editRecords', ['super-admin', 'editor', 'contributor']],
    ['createClaims', ['super-admin', 'editor', 'contributor']],
    ['reviewCandidates', ['super-admin', 'editor', 'reviewer']],
    ['setVerdict', ['super-admin', 'editor', 'reviewer']],
    ['rateClaims', ['super-admin', 'editor']],
    ['promoteSubmissions', ['super-admin', 'editor', 'moderator']],
    ['setAnyRecordStatus', ['super-admin', 'editor']],
    ['holdRecords', ['super-admin', 'editor', 'contributor']],
    ['moderateSubmissions', ['super-admin', 'editor', 'moderator']],
    ['editEditorial', ['super-admin', 'editor']],
    ['deleteRecords', ['super-admin', 'editor']],
    ['overridePluginFields', ['super-admin']],
  ]

  it('has a test line for every rule', () => {
    expect(matrix.map(([rule]) => rule).sort()).toEqual(Object.keys(can).sort())
  })

  for (const [rule, allowed] of matrix) {
    it(`${rule}: ${allowed.join(', ')}, and nobody else`, () => {
      for (const role of ROLES) {
        expect(can[rule](as(role)), role).toBe(allowed.includes(role))
      }
      expect(can[rule](guest)).toBe(false)
    })
  }

  it('lets a viewer read and do nothing else', () => {
    expect(signedIn(as('viewer'))).toBe(true)
    for (const rule of Object.values(can)) expect(rule(as('viewer'))).toBe(false)
  })

  it('lets a contributor hold a record, and only an editor release or archive it', () => {
    const user = (role: Role) => ({ id: 'u1', roles: [role] }) as never
    expect(maySetRecordStatus(user('contributor'), 'hold')).toBe(true)
    expect(maySetRecordStatus(user('contributor'), 'ready')).toBe(false)
    expect(maySetRecordStatus(user('contributor'), 'archived')).toBe(false)
    expect(maySetRecordStatus(user('editor'), 'ready')).toBe(true)
    expect(maySetRecordStatus(user('reviewer'), 'hold')).toBe(false)
    expect(maySetRecordStatus(null, 'hold')).toBe(false)
  })

  it('gives each kind of record type a ready-made access block that closes it to guests', () => {
    for (const block of Object.values(access)) {
      for (const rule of Object.values(block)) expect(rule(guest)).toBe(false)
    }
    expect(access.records.create(as('contributor'))).toBe(true)
    expect(access.records.delete(as('contributor'))).toBe(false)
    expect(access.structure.update(as('editor'))).toBe(false)
  })
})

describe('the users collection', () => {
  const field = (name: string) => {
    const found = Users.fields.find((f) => 'name' in f && f.name === name)
    if (!found) throw new Error(`no field ${name}`)
    return found as Field & { access?: { update?: typeof signedIn; create?: typeof signedIn } }
  }

  it('signs in with sessions and refresh tokens, and locks after five wrong passwords', () => {
    expect(Users.auth).toMatchObject({
      useSessions: true,
      // Payload fills in the defaults once the config is built.
      refreshTokens: expect.anything(),
      maxLoginAttempts: 5,
      lockTime: 15 * 60 * 1000,
    })
  })

  it('lets only a super-admin hand out roles and countries', () => {
    for (const name of ['roles', 'countries']) {
      expect(field(name).access?.update?.(as('editor'))).toBe(false)
      expect(field(name).access?.create?.(as('editor'))).toBe(false)
      expect(field(name).access?.update?.(as('super-admin'))).toBe(true)
    }
  })

  it('lets a user change their own record and a super-admin change anyone', () => {
    const update = Users.access?.update
    const call = (roles: Role[], id: string) =>
      update?.({ req: { user: { id: 'u1', roles } }, id } as never)
    expect(call(['viewer'], 'u1')).toBe(true)
    expect(call(['editor'], 'u2')).toBe(false)
    expect(call(['super-admin'], 'u2')).toBe(true)
  })

  it('closes creating and deleting users to everyone but a super-admin', () => {
    expect(Users.access?.create?.(as('editor') as never)).toBe(false)
    expect(Users.access?.delete?.(as('editor') as never)).toBe(false)
    expect(Users.access?.create?.(as('super-admin') as never)).toBe(true)
    expect(Users.access?.read?.(guest as never)).toBe(false)
  })
})

describe('private history', () => {
  const config = privateHistory({
    collections: [
      { slug: 'open', access: { read: () => true }, fields: [{ name: 'title', type: 'text' }] },
      { slug: 'untracked', authorship: false, fields: [] },
      { slug: 'half', authorship: { updatedBy: false }, fields: [] },
    ],
    globals: [{ slug: 'site', access: { read: () => true }, fields: [] }],
  } as unknown as Config)
  const names = (fields: readonly Field[]) => fields.map((f) => ('name' in f ? f.name : f.type))
  const collection = (slug: string) => {
    const found = config.collections?.find((c) => c.slug === slug)
    if (!found) throw new Error(`no collection ${slug}`)
    return found
  }

  it('closes version history to guests, even on a record type guests can read', () => {
    for (const entity of [...(config.collections ?? []), ...(config.globals ?? [])]) {
      expect(entity.access?.readVersions?.(guest as never)).toBe(false)
      expect(entity.access?.readVersions?.(as('viewer') as never)).toBe(true)
    }
    expect(collection('open').access?.read?.(guest as never)).toBe(true)
  })

  it('closes created-by and changed-by to guests on record types and globals', () => {
    const entities = [collection('open'), ...(config.globals ?? [])]
    for (const entity of entities) {
      for (const name of ['createdBy', 'updatedBy']) {
        const field = entity.fields.find((f) => 'name' in f && f.name === name) as
          | (Field & { access?: { read?: typeof signedIn } })
          | undefined
        expect(field?.access?.read?.(guest)).toBe(false)
        expect(field?.access?.read?.(as('viewer'))).toBe(true)
      }
    }
  })

  it('adds nothing where authorship is switched off', () => {
    expect(names(collection('untracked').fields)).toEqual([])
    expect(names(collection('half').fields)).toEqual(['createdBy'])
  })
})

describe('the first super-admin', () => {
  const fake = (existing: number) => {
    const create = vi.fn(async () => ({}))
    const warn = vi.fn()
    const info = vi.fn()
    const payload = {
      count: vi.fn(async () => ({ totalDocs: existing })),
      create,
      logger: { warn, info },
    }
    return { payload: payload as unknown as Payload, create, warn, info }
  }
  const env = { PT_ADMIN_EMAIL: 'admin@example.org', PT_ADMIN_PASSWORD: 'a-long-password' }

  it('is created from the environment while no user exists', async () => {
    const { payload, create, info } = fake(0)
    await ensureFirstAdmin(payload, env)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({ email: 'admin@example.org', roles: ['super-admin'] }),
      }),
    )
    // Logs never hold email addresses.
    expect(JSON.stringify(info.mock.calls)).not.toContain('admin@example.org')
  })

  it('is not created once any user exists', async () => {
    const { payload, create } = fake(1)
    await ensureFirstAdmin(payload, env)
    expect(create).not.toHaveBeenCalled()
  })

  it('warns, without failing, when the variables are not set', async () => {
    const { payload, create, warn } = fake(0)
    await ensureFirstAdmin(payload, {})
    expect(create).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PT_ADMIN_EMAIL'))
  })

  it('stops start-up on a short password', async () => {
    const { payload } = fake(0)
    await expect(ensureFirstAdmin(payload, { ...env, PT_ADMIN_PASSWORD: 'short' })).rejects.toThrow(
      'at least 12 characters',
    )
  })
})

describe('what a guest may call on the REST routes', () => {
  it('allows signing in, password reset and public media files', () => {
    expect(guestMayCall('POST', '/users/login')).toBe(true)
    expect(guestMayCall('POST', '/users/logout')).toBe(true)
    expect(guestMayCall('POST', '/users/refresh-token')).toBe(true)
    expect(guestMayCall('GET', '/users/me')).toBe(true)
    expect(guestMayCall('POST', '/users/forgot-password')).toBe(true)
    expect(guestMayCall('POST', '/users/reset-password')).toBe(true)
    expect(guestMayCall('GET', '/media/file/photo.jpg')).toBe(true)
  })

  it('ignores trailing slashes, however many', () => {
    expect(guestMayCall('POST', '/users/login/')).toBe(true)
    expect(guestMayCall('GET', `/users${'/'.repeat(50_000)}`)).toBe(false)
    expect(guestMayCall('GET', '/')).toBe(false)
  })

  it('refuses everything else, registering included', () => {
    for (const [method, path] of [
      ['POST', '/users/first-register'],
      ['POST', '/users/unlock'],
      ['GET', '/users'],
      ['POST', '/users'],
      ['GET', '/users/login'],
      ['GET', '/media'],
      ['GET', '/media/abc'],
      ['GET', '/media/file/a/b'],
      ['DELETE', '/media/file/photo.jpg'],
      ['GET', '/globals/site'],
      ['GET', '/settings'],
      ['GET', '/access'],
      ['GET', '/'],
    ] as const) {
      expect(guestMayCall(method, path), `${method} ${path}`).toBe(false)
    }
  })
})

describe('the last super-admin', () => {
  const superAdmin = { id: 'u1', roles: ['super-admin'] }
  const req = (others: number) =>
    ({
      payload: {
        count: vi.fn(async () => ({ totalDocs: others })),
        findByID: vi.fn(async () => superAdmin),
      },
    }) as never
  const beforeChange = Users.hooks?.beforeChange?.[0]
  const beforeDelete = Users.hooks?.beforeDelete?.[0]
  const demote = (others: number, roles: unknown = ['editor']) =>
    beforeChange?.({
      data: { roles },
      originalDoc: superAdmin,
      operation: 'update',
      req: req(others),
    } as never)

  it('cannot lose the role', async () => {
    await expect(demote(0)).rejects.toThrow('last super-admin')
  })

  it('can lose the role once there is another', async () => {
    await expect(demote(1)).resolves.toEqual({ roles: ['editor'] })
  })

  it('can change other things about themselves', async () => {
    await expect(demote(0, ['super-admin', 'editor'])).resolves.toBeDefined()
    await expect(
      beforeChange?.({
        data: { name: 'New name' },
        originalDoc: superAdmin,
        operation: 'update',
        req: req(0),
      } as never),
    ).resolves.toBeDefined()
  })

  it('cannot be deleted, by themselves or anyone', async () => {
    await expect(beforeDelete?.({ id: 'u1', req: req(0) } as never)).rejects.toThrow(
      'last super-admin',
    )
    await expect(beforeDelete?.({ id: 'u1', req: req(1) } as never)).resolves.toBeUndefined()
  })
})

describe('permissions without a request', () => {
  it('answers for a user directly', () => {
    expect(userCan({ roles: ['reviewer'] } as never, 'setVerdict')).toBe(true)
    expect(userCan({ roles: ['reviewer'] } as never, 'rateClaims')).toBe(false)
    expect(userCan(null, 'setVerdict')).toBe(false)
  })
})

describe('the method a request is judged by', () => {
  const request = (method: string, headers: Record<string, string> = {}) =>
    effectiveMethod({ method, headers: new Headers(headers) })

  it('is GET for a POST that Payload will handle as a GET', () => {
    expect(request('POST', { 'X-Payload-HTTP-Method-Override': 'GET' })).toBe('GET')
    expect(request('POST', { 'x-http-method-override': 'GET' })).toBe('GET')
  })

  it('is the request method otherwise', () => {
    expect(request('POST')).toBe('POST')
    expect(request('post')).toBe('POST')
    expect(request('GET', { 'X-Payload-HTTP-Method-Override': 'GET' })).toBe('GET')
    expect(request('POST', { 'X-Payload-HTTP-Method-Override': 'DELETE' })).toBe('POST')
  })

  it('so a guest cannot dress a read up as an allowed POST', () => {
    const method = request('POST', { 'X-Payload-HTTP-Method-Override': 'GET' })
    expect(guestMayCall(method, '/users/login')).toBe(false)
    expect(guestMayCall(method, '/users/forgot-password')).toBe(false)
  })
})

describe("Payload's REST route file", () => {
  // Payload generated this file, and an upgrade may generate it again. If the
  // gate is lost, every REST route opens to guests, so this fails first.
  const file = readFileSync(
    path.resolve(import.meta.dirname, '../../apps/site/src/app/(payload)/api/[...slug]/route.ts'),
    'utf8',
  )
  const handlers = [...file.matchAll(/^export const (\w+) = (.*)$/gm)]

  it('wraps every handler in the guest gate', () => {
    expect(handlers.map((m) => m[1]).sort()).toEqual(
      ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT'].sort(),
    )
    for (const [, name, value] of handlers) {
      expect(value, name).toMatch(/^gateRest\(REST_\w+\(config\)\)$/)
    }
  })
})
