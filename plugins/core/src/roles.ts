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

/** A user's roles. Empty for a guest, and for a user from another auth collection. */
export function rolesOf(user: PayloadRequest['user']): Role[] {
  const roles: unknown = user ? Reflect.get(user, 'roles') : undefined
  return Array.isArray(roles) ? roles.filter(isRole) : []
}

export function hasRole(user: PayloadRequest['user'], ...roles: readonly Role[]): boolean {
  const held = rolesOf(user)
  return roles.some((role) => held.includes(role))
}
