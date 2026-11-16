import type { CollectionConfig } from 'payload'

import { can, signedIn } from './access'
import { ROLES } from './roles'

const COUNTRY_CODE = /^[a-z]{2}$/

/**
 * Editors sign in with Payload's email and password (D43). Nobody registers:
 * the first super-admin comes from the environment (D48), and a super-admin
 * creates everyone else.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email', defaultColumns: ['name', 'email', 'roles'] },
  auth: {
    useSessions: true,
    // Editors stay signed in across the working day without typing a password again.
    refreshTokens: true,
    // Five wrong passwords lock the account for fifteen minutes.
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
  },
  access: {
    // Any role may enter the admin. What they can do there is decided per record type.
    admin: signedIn,
    // Staff can see who their colleagues are. Guests cannot (section 13.6).
    read: signedIn,
    create: can.manageUsers,
    // A user changes their own name and password. A super-admin changes anyone's,
    // which is also how a password is reset until email works (D40).
    update: ({ req, id }) => can.manageUsers({ req }) || (Boolean(id) && req.user?.id === id),
    delete: can.manageUsers,
    unlock: can.manageUsers,
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['viewer'],
      options: ROLES.map((role) => ({ label: role, value: role })),
      // In the token, so access rules read roles without a database read.
      saveToJWT: true,
      // Only a super-admin hands out roles. Without this a user could promote themselves.
      access: { create: can.manageUsers, update: can.manageUsers },
    },
    {
      name: 'countries',
      type: 'text',
      hasMany: true,
      admin: {
        description:
          'Two-letter country codes this user works on, such as ke. Not enforced in version 1.',
      },
      validate: (value: unknown) =>
        !Array.isArray(value) || value.every((code) => COUNTRY_CODE.test(String(code)))
          ? true
          : 'Use two-letter country codes in lower case, such as ke.',
      access: { create: can.manageUsers, update: can.manageUsers },
    },
  ],
}
