import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from './access'
import { ROLES, rolesIn } from './roles'

const COUNTRY_CODE = /^[a-z]{2}$/

const LAST_SUPER_ADMIN =
  'This is the last super-admin. Make another user a super-admin first, or nobody could manage users.'

/**
 * Whether any super-admin would be left without this user. Without one, nobody
 * could manage users, and the first-admin set-up only runs on an empty
 * database, so the way back would be the database itself.
 *
 * This counts, then lets the change through, so it is not a lock: two
 * super-admins removing each other in the same instant could both pass. It
 * stops the mistake, which is one person acting alone.
 */
async function anotherSuperAdminExists(req: PayloadRequest, id: unknown): Promise<boolean> {
  const { totalDocs } = await req.payload.count({
    collection: 'users',
    where: { and: [{ roles: { in: ['super-admin'] } }, { id: { not_equals: id } }] },
    // A count of other users' roles, whoever is asking. No record is returned.
    overrideAccess: true,
    req,
  })
  return totalDocs > 0
}

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
    // Ids are compared as text, so this holds whatever type the id arrives as.
    update: ({ req, id }) =>
      can.manageUsers({ req }) ||
      (id !== undefined && req.user !== null && String(req.user.id) === String(id)),
    delete: can.manageUsers,
    unlock: can.manageUsers,
  },
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        const losesRole =
          operation === 'update' &&
          rolesIn(originalDoc).includes('super-admin') &&
          Array.isArray(data.roles) &&
          !data.roles.includes('super-admin')
        if (losesRole && !(await anotherSuperAdminExists(req, originalDoc.id))) {
          throw new APIError(LAST_SUPER_ADMIN, 400)
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const user = await req.payload.findByID({
          collection: 'users',
          id,
          depth: 0,
          // Reads only the roles of the user being deleted, to apply the rule below.
          overrideAccess: true,
          req,
        })
        if (rolesIn(user).includes('super-admin') && !(await anotherSuperAdminExists(req, id))) {
          throw new APIError(LAST_SUPER_ADMIN, 400)
        }
      },
    ],
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
      // Only a super-admin hands out roles. Without this a user could promote themselves.
      // Payload loads the user from the database on every request, so a change
      // of roles takes effect on that user's next request, not at their next sign-in.
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
