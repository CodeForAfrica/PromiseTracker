import type { CollectionConfig, GlobalConfig, PayloadRequest } from 'payload'

import type { Role } from '../roles'
import { hasRole } from '../roles'

/**
 * Access rules for the permission matrix in section 13.2. Every record type
 * builds its rules from these, so a change to the matrix is made once, here.
 *
 * A rule takes only the request, so the same rule works on a record type, a
 * global and a single field.
 */
export type Rule = (args: { req: PayloadRequest }) => boolean

/** Any signed-in user, whatever their role. A viewer can read and nothing more. */
export const signedIn: Rule = ({ req }) => Boolean(req.user)

/** The matrix: one entry per row, with the roles that may. */
const MATRIX = {
  /** Manage countries, offices and areas. */
  manageStructure: ['super-admin'],
  /** Manage rating scales and claim types. */
  manageRatings: ['super-admin'],
  /** Manage users, settings and credentials. */
  manageUsers: ['super-admin'],
  /** Create or edit actors, terms and documents. */
  editRecords: ['super-admin', 'editor', 'contributor'],
  /** Create claims by hand. */
  createClaims: ['super-admin', 'editor', 'contributor'],
  /** Accept or reject AI candidates. */
  reviewCandidates: ['super-admin', 'editor', 'reviewer'],
  /** Set a verdict. A verification plugin takes this over (section 4.5). */
  setVerdict: ['super-admin', 'editor', 'reviewer'],
  /** Rate a claim, and add or confirm updates. */
  rateClaims: ['super-admin', 'editor'],
  /** Turn a submission into a claim update, which is how a moderator rates. */
  promoteSubmissions: ['super-admin', 'editor', 'moderator'],
  /** Set a record to ready, hold or archived. */
  setAnyRecordStatus: ['super-admin', 'editor'],
  /** Set a record to hold, and nothing else. */
  holdRecords: ['super-admin', 'editor', 'contributor'],
  /** Moderate submissions. */
  moderateSubmissions: ['super-admin', 'editor', 'moderator'],
  /** Edit picks, themes, articles and pages. */
  editEditorial: ['super-admin', 'editor'],
  /** Delete a record, to the trash. */
  deleteRecords: ['super-admin', 'editor'],
  /** Override a field a plugin owns. The kernel logs it. */
  overridePluginFields: ['super-admin'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof MATRIX

/** Whether a user may do something, for code that has a user and no request. */
export function userCan(user: PayloadRequest['user'], permission: Permission): boolean {
  return hasRole(user, ...MATRIX[permission])
}

const rule =
  (permission: Permission): Rule =>
  ({ req }) =>
    userCan(req.user, permission)

/** The matrix as access rules: `can.editRecords`, `can.setVerdict` and so on. */
export const can = {
  manageStructure: rule('manageStructure'),
  manageRatings: rule('manageRatings'),
  manageUsers: rule('manageUsers'),
  editRecords: rule('editRecords'),
  createClaims: rule('createClaims'),
  reviewCandidates: rule('reviewCandidates'),
  setVerdict: rule('setVerdict'),
  rateClaims: rule('rateClaims'),
  promoteSubmissions: rule('promoteSubmissions'),
  setAnyRecordStatus: rule('setAnyRecordStatus'),
  holdRecords: rule('holdRecords'),
  moderateSubmissions: rule('moderateSubmissions'),
  editEditorial: rule('editEditorial'),
  deleteRecords: rule('deleteRecords'),
  overridePluginFields: rule('overridePluginFields'),
} as const satisfies Record<Permission, Rule>

export type RecordStatus = 'ready' | 'hold' | 'archived'

/** Whether a user may set this record status. A contributor may only hold. */
export function maySetRecordStatus(user: PayloadRequest['user'], status: RecordStatus): boolean {
  return userCan(user, 'setAnyRecordStatus') || (status === 'hold' && userCan(user, 'holdRecords'))
}

type CollectionAccess = NonNullable<CollectionConfig['access']>

/**
 * Whole access blocks, so a record type declares its access in one line:
 * `access: access.records`. Staff read everything. What a guest may read is
 * decided by the publishing rules, which arrive with the first public record
 * type.
 */
export const access = {
  /** Countries, offices, areas. */
  structure: {
    read: signedIn,
    create: can.manageStructure,
    update: can.manageStructure,
    delete: can.manageStructure,
  },
  /** Rating scales and claim types. */
  ratings: {
    read: signedIn,
    create: can.manageRatings,
    update: can.manageRatings,
    delete: can.manageRatings,
  },
  /** Actors, terms, documents, claims. */
  records: {
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  /** Themes, articles, pages, partners. */
  editorial: {
    read: signedIn,
    create: can.editEditorial,
    update: can.editEditorial,
    delete: can.deleteRecords,
  },
  /** Submissions. */
  submissions: {
    read: can.moderateSubmissions,
    create: can.moderateSubmissions,
    update: can.moderateSubmissions,
    delete: can.deleteRecords,
  },
} as const satisfies Record<string, CollectionAccess>

type GlobalAccess = NonNullable<GlobalConfig['access']>

/** Access blocks for globals, which have no create or delete. */
export const globalAccess = {
  /** Picks and site settings: staff read, editors change. */
  editorial: { read: signedIn, update: can.editEditorial },
  /** Settings that hold credentials. */
  settings: { read: can.manageUsers, update: can.manageUsers },
} as const satisfies Record<string, GlobalAccess>
