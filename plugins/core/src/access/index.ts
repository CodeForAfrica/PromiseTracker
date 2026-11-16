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

const anyOf =
  (...roles: readonly Role[]): Rule =>
  ({ req }) =>
    hasRole(req.user, ...roles)

/** Any signed-in user, whatever their role. A viewer can read and nothing more. */
export const signedIn: Rule = ({ req }) => Boolean(req.user)

/** One entry per row of the matrix. */
export const can = {
  /** Manage countries, offices and areas. */
  manageStructure: anyOf('super-admin'),
  /** Manage rating scales and claim types. */
  manageRatings: anyOf('super-admin'),
  /** Manage users, settings and credentials. */
  manageUsers: anyOf('super-admin'),
  /** Create or edit actors, terms and documents. */
  editRecords: anyOf('super-admin', 'editor', 'contributor'),
  /** Create claims by hand. */
  createClaims: anyOf('super-admin', 'editor', 'contributor'),
  /** Accept or reject AI candidates. */
  reviewCandidates: anyOf('super-admin', 'editor', 'reviewer'),
  /** Set a verdict. A verification plugin takes this over (section 4.5). */
  setVerdict: anyOf('super-admin', 'editor', 'reviewer'),
  /** Rate a claim, and add or confirm updates. */
  rateClaims: anyOf('super-admin', 'editor'),
  /** Turn a submission into a claim update, which is how a moderator rates. */
  promoteSubmissions: anyOf('super-admin', 'editor', 'moderator'),
  /** Set a record to ready, hold or archived. */
  setAnyRecordStatus: anyOf('super-admin', 'editor'),
  /** Set a record to hold, and nothing else. */
  holdRecords: anyOf('super-admin', 'editor', 'contributor'),
  /** Moderate submissions. */
  moderateSubmissions: anyOf('super-admin', 'editor', 'moderator'),
  /** Edit picks, themes, articles and pages. */
  editEditorial: anyOf('super-admin', 'editor'),
  /** Delete a record, to the trash. */
  deleteRecords: anyOf('super-admin', 'editor'),
  /** Override a field a plugin owns. The kernel logs it. */
  overridePluginFields: anyOf('super-admin'),
} as const satisfies Record<string, Rule>

export type RecordStatus = 'ready' | 'hold' | 'archived'

/** Whether a user may set this record status. A contributor may only hold. */
export function maySetRecordStatus(user: PayloadRequest['user'], status: RecordStatus): boolean {
  const req = { user } as PayloadRequest
  return can.setAnyRecordStatus({ req }) || (status === 'hold' && can.holdRecords({ req }))
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
