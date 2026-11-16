import type { PayloadRequest } from 'payload'

/** The roles in section 13.2. A user can hold more than one. */
export const ROLES = [
  'super-admin',
  'editor',
  'contributor',
  'reviewer',
  'moderator',
  'viewer',
] as const

export type Role = (typeof ROLES)[number]

const isRole = (value: unknown): value is Role => ROLES.some((role) => role === value)

/** The roles on a user record, however it was read. Empty when there are none. */
export function rolesIn(record: unknown): Role[] {
  const roles: unknown =
    record && typeof record === 'object' ? Reflect.get(record, 'roles') : undefined
  return Array.isArray(roles) ? roles.filter(isRole) : []
}

/** A user's roles. Empty for a guest, and for a user from another auth collection. */
export function rolesOf(user: PayloadRequest['user']): Role[] {
  return rolesIn(user)
}

export function hasRole(user: PayloadRequest['user'], ...roles: readonly Role[]): boolean {
  const held = rolesOf(user)
  return roles.some((role) => held.includes(role))
}
