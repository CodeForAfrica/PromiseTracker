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
  urlConnector,
} from './adapters'
import { ADMIN_GROUPS } from './adminGroups'
import { Boundaries } from './boundaries'
import { Claims, Topics } from './claims'
import { Countries } from './countries'
import { DocumentFiles, Documents } from './documents/collections'
import {
  cleanupJobsTask,
  extractTextTask,
  fetchDocumentTask,
  processDocumentWorkflow,
} from './documents/pipeline'
import { Articles, Pages, Partners, SisterTools, Themes } from './editorial'
import { NewsletterSignups, SubmissionFiles, Submissions, submissionDigestTask } from './forms'
import { ImportMappings, Imports, runImportTask } from './imports/collections'
import { csvImporter, xlsxImporter } from './imports/readers'
import { Areas, Offices } from './places'
import { ClaimTypes, RatingScales } from './ratings'
import { SearchLog } from './search'
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
    Documents,
    DocumentFiles,
    Claims,
    ClaimUpdates,
    Evidence,
    RatingReviews,
    Topics,
    Themes,
    Articles,
    Pages,
    Partners,
    SisterTools,
    RatingScales,
    ClaimTypes,
    Media,
    Submissions,
    SubmissionFiles,
    NewsletterSignups,
    Imports,
    ImportMappings,
    SearchLog,
    Users,
  ],
  tasks: [
    runImportTask as never,
    fetchDocumentTask as never,
    extractTextTask as never,
    cleanupJobsTask as never,
    cascadePublishingTask as never,
    recomputePublishingTask as never,
    dailyPublishingTask as never,
    refreshCountsTask as never,
    submissionDigestTask as never,
  ],
  workflows: [processDocumentWorkflow as never],
  widgets: [
    {
      slug: 'least-recently-reviewed',
      Component: '@promisetracker/plugin-core/widgets#LeastRecentlyReviewed',
      minWidth: 'small',
      maxWidth: 'large',
    },
    {
      slug: 'awaiting-verification',
      Component: '@promisetracker/plugin-core/widgets#AwaitingVerification',
      minWidth: 'small',
      maxWidth: 'medium',
    },
    {
      slug: 'submissions',
      label: 'Submissions',
      Component: '@promisetracker/plugin-core/widgets#SubmissionsWidget',
      minWidth: 'small',
      maxWidth: 'medium',
    },
    {
      slug: 'empty-searches',
      label: 'Searches that found nothing',
      Component: '@promisetracker/plugin-core/widgets#EmptySearches',
      minWidth: 'medium',
    },
  ],
  provides: {
    verification: [nativeVerification],
    sourceConnector: [uploadConnector, urlConnector],
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
export {
  CHALLENGE_TTL_MS,
  checkAnswer,
  clientAddress,
  createRateLimiter,
  hasLeadingZeroBits,
  newChallenge,
  POW_BITS,
  powHash,
  scrambleAddress,
  solve,
} from './captcha'
export type { DatePrecision } from './claims'
export { Claims, EXTRACTIONS, PARTIAL_DATE, partialDatePrecision, Topics } from './claims'
export * from './contrast'
export { Countries } from './countries'
export * from './countryList'
export * from './defaultRatings'
export { DocumentFiles, Documents } from './documents/collections'
export * from './documents/connectors'
export * from './documents/download'
export * from './documents/fileType'
export * from './documents/pipeline'
export * from './documents/plaintext'
export * from './documents/ssrf'
export {
  ABOUT_TYPES,
  Articles,
  PAGE_DEPTH,
  Pages,
  Partners,
  SisterTools,
  Themes,
} from './editorial'
export * from './fields/encryptedSecret'
export type { NewSubmission, SubmissionFile, SubmissionKind } from './forms'
export {
  CONFIRM_TTL_MS,
  confirmSignup,
  createSubmission,
  DISCARD_AFTER_DAYS,
  MAX_SUBMISSION_FILE,
  MAX_SUBMISSION_FILES,
  NewsletterSignups,
  SUBMISSION_FILE_TYPES,
  SUBMISSION_KINDS,
  SUBMISSION_STATUSES,
  SubmissionFiles,
  Submissions,
  submissionCounts,
  submissionDigest,
  submissionReference,
} from './forms'
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

import { cascadePublishingTask, dailyPublishingTask, recomputePublishingTask } from './publishing'

export { VERDICTS, verdictOf } from './claims'
export type { ImportTarget } from './imports/targets'
export { guessMapping, IMPORT_TARGETS, mappingKeys, planRow } from './imports/targets'
export * from './locales'
export type { AreaType } from './places'
export { AREA_PAGE, AREA_TYPES, Areas, Offices } from './places'
export * from './publishing'
export { findQuote } from './quote'
export * from './ratings'
export * from './roles'
export type { EmptySearch } from './search'
export {
  beforeSync,
  EMPTY_SEARCH_DAYS,
  EMPTY_SEARCH_ROWS,
  emptySearches,
  entryOf,
  indexLater,
  indexRecord,
  liveIn,
  logSearch,
  MAX_QUERY,
  PLACE_LIMIT,
  SEARCH_LIMIT,
  SEARCH_LOG_SLUG,
  SEARCH_PRIORITY,
  SEARCH_SLUG,
  SEARCHED,
  SearchLog,
  searchIndex,
  setSearchIndexer,
  skipSync,
} from './search'
export * from './slugs'
export { Users } from './users'
// Widgets are loaded by the admin through `@promisetracker/plugin-core/widgets`, never from
// here: they import Payload's admin components, which the public site must not ship.
export {
  AWAITING_VERIFICATION,
  ensureVerificationQueue,
  VERIFICATION_QUEUE,
  whereToQuery,
} from './verificationQueue'

import { ClaimUpdates, Evidence, RatingReviews, refreshCountsTask } from './updates'

export {
  ClaimUpdates,
  EVIDENCE_KINDS,
  Evidence,
  partialDateStart,
  RatingReviews,
  ratingFromUpdates,
  UPDATE_KINDS,
} from './updates'
