import type { CollectionConfig, PayloadRequest } from 'payload'

import { can } from './access'
import { refreshOnChange } from './cache'
import { readReadyOrStaff, withPublishing } from './publishing'

/** Regions, for grouping countries once there are many (section 7.1). */
export const REGIONS = [
  'east-africa',
  'west-africa',
  'central-africa',
  'southern-africa',
  'north-africa',
] as const

const COUNTRY_CODE = /^[a-z]{2}$/

const registeredLocales = (req: PayloadRequest): readonly string[] =>
  req.payload.config.localization ? req.payload.config.localization.localeCodes : []

const tagsFor = (doc: { code?: unknown }) =>
  typeof doc.code === 'string' ? [`country:${doc.code}`, 'countries'] : ['countries']

const cacheHooks = refreshOnChange(tagsFor)

/**
 * A country (section 7.1). Its code is part of every address on the site, so
 * it is two lower-case letters and never changes meaning. Only super-admins
 * manage countries (section 13.2).
 *
 * The root area arrives with areas in #645, which adds the field.
 */
export const Countries: CollectionConfig = withPublishing(
  {
    slug: 'countries',
    admin: {
      useAsTitle: 'name',
      defaultColumns: ['name', 'code', 'recordStatus', 'publishedIn'],
    },
    access: {
      read: readReadyOrStaff,
      create: can.manageStructure,
      update: can.manageStructure,
      delete: can.manageStructure,
    },
    hooks: {
      afterChange: [cacheHooks.afterChange],
      afterDelete: [cacheHooks.afterDelete],
    },
    fields: [
      {
        name: 'code',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        admin: { description: 'Two-letter ISO code in lower case, such as ke. Used in addresses.' },
        validate: (value: unknown) =>
          typeof value === 'string' && COUNTRY_CODE.test(value)
            ? true
            : 'Use the two-letter ISO code in lower case, such as ke.',
      },
      { name: 'name', type: 'text', required: true, localized: true },
      {
        name: 'region',
        type: 'select',
        options: REGIONS.map((value) => ({ label: value, value })),
      },
      {
        name: 'languages',
        type: 'text',
        hasMany: true,
        admin: {
          description: 'Language codes this country publishes in, such as en and fr.',
        },
        validate: (value: unknown, { req }: { req: PayloadRequest }) => {
          const known = registeredLocales(req)
          const codes = Array.isArray(value) ? value.map(String) : []
          const unknown = codes.filter((code) => !known.includes(code))
          return unknown.length === 0
            ? true
            : `Not a registered language: ${unknown.join(', ')}. Use ${known.join(', ')}.`
        },
      },
      {
        name: 'defaultLanguage',
        type: 'text',
        admin: { description: 'One of the languages above.' },
        validate: (value: unknown, { siblingData }: { siblingData: { languages?: unknown } }) => {
          if (value === null || value === undefined || value === '') return true
          const languages = Array.isArray(siblingData.languages) ? siblingData.languages : []
          return languages.includes(value) ? true : 'Choose one of the languages above.'
        },
      },
      { name: 'about', type: 'textarea', localized: true },
    ],
  },
  ['name'],
)
