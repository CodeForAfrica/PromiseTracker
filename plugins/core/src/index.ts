import { definePromiseTrackerPlugin } from '@promisetracker/kernel'
import type { CollectionConfig } from 'payload'
import { can } from './access'
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
import { Countries } from './countries'
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
  collections: [RatingScales, ClaimTypes, Countries, Media, Users],
  provides: {
    verification: [nativeVerification],
    sourceConnector: [uploadConnector],
    contentExtractor: [plaintextExtractor],
    search: [payloadSearch],
    newsletter: [localNewsletter],
    analytics: [noAnalytics],
    captcha: [localCaptcha],
  },
})

export * from './access'
export * from './adapters'
export { ADMIN_GROUPS } from './adminGroups'
export { afterCommit, installAfterCommit } from './afterCommit'
export * from './cache'
export * from './contrast'
export { Countries } from './countries'
export * from './countryList'
export * from './defaultRatings'
export { privateHistory } from './history'
export * from './locales'
export * from './publishing'
export * from './ratings'
export * from './roles'
export { Users } from './users'
