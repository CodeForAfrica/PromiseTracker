import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import type { CollectionConfig } from 'payload'
import { can } from './access'
import { Actors, Terms } from './actors'
import {
  localCaptcha,
  localNewsletter,
  nativeVerification,
  noAnalytics,
  payloadSearch,
  plaintextExtractor,
  uploadConnector,
} from './adapters'
import { ADMIN_GROUPS } from './adminGroups'
import { Boundaries } from './boundaries'
import { Claims, Topics } from './claims'
import { Countries } from './countries'
import { ImportMappings, Imports, runImportTask } from './imports/collections'
import { csvImporter, xlsxImporter } from './imports/readers'
import { Areas, Offices } from './places'
import { ClaimTypes, RatingScales } from './ratings'
import { Users } from './users'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: ADMIN_GROUPS.library },
  access: {
    // Media is public: actor photos and article images. Source documents are
    // a separate record type and are not.
    read: () => true,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: true,
}

/**
 * plugin-core: the data model, the admin and a default adapter for every port
 * that needs one, so PromiseTracker runs with nothing else enabled.
 */
export const corePlugin = definePromiseTrackerPlugin({
  slug: 'core',
  version: '0.1.0',
  order: 0,
  // The admin's menu lists groups in this order: the editors' work first, administration last.
  collections: [
    Actors,
    Terms,
    Countries,
    Areas,
    Offices,
    Boundaries,
    Claims,
    Topics,
    RatingScales,
    ClaimTypes,
    Media,
    Imports,
    ImportMappings,
    Users,
  ],
  tasks: [runImportTask as never],
  provides: {
    verification: [nativeVerification],
    sourceConnector: [uploadConnector],
    contentExtractor: [plaintextExtractor],
    structuredImporter: [csvImporter, xlsxImporter],
    search: [payloadSearch],
    newsletter: [localNewsletter],
    analytics: [noAnalytics],
    captcha: [localCaptcha],
  },
})

export * from './access'
export type { ActorKind, TermStage } from './actors'
export {
  ACTOR_KINDS,
  Actors,
  currentTerms,
  onRecord,
  pastTerms,
  TERM_STAGES,
  Terms,
  termStage,
} from './actors'
export * from './adapters'
export { ADMIN_GROUPS } from './adminGroups'
export { afterCommit, installAfterCommit } from './afterCommit'
export { Boundaries, geoJsonProblem, MAX_BOUNDARY_BYTES } from './boundaries'
export * from './cache'
export type { DatePrecision } from './claims'
export { Claims, EXTRACTIONS, PARTIAL_DATE, partialDatePrecision, Topics } from './claims'
export * from './contrast'
export { Countries } from './countries'
export * from './countryList'
export * from './defaultRatings'
export { privateHistory } from './history'
export { setImporters } from './imports/collections'
export type { ImportResult, RowError } from './imports/engine'
export { runImportPlan } from './imports/engine'
export {
  csvImporter,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  readCsv,
  xlsxImporter,
} from './imports/readers'
export type { ImportTarget } from './imports/targets'
export { guessMapping, IMPORT_TARGETS, mappingKeys, planRow } from './imports/targets'
export * from './locales'
export type { AreaType } from './places'
export { AREA_PAGE, AREA_TYPES, Areas, Offices } from './places'
export * from './publishing'
export * from './ratings'
export * from './roles'
export * from './slugs'
export { Users } from './users'
