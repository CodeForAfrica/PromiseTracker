import type {
  CollectionAfterChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'

import { can } from './access'
import { refreshOnChange } from './cache'
import {
  COUNTRY_CODES,
  countryDefaults,
  countryName,
  countryNames,
  isCountryCode,
  REGIONS,
} from './countryList'
import { DEFAULT_LOCALE, isLocaleCode, REGISTERED_LOCALES } from './locales'
import { readReadyOrStaff, withPublishing } from './publishing'

const tagsFor = (doc: { code?: unknown }) =>
  typeof doc.code === 'string' ? [`country:${doc.code}`, 'countries'] : ['countries']

const cacheHooks = refreshOnChange(tagsFor)

const LANGUAGE_OPTIONS = REGISTERED_LOCALES.map((l) => ({
  label: `${l.label} (${l.code})`,
  value: l.code,
}))

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !value.trim()) ||
  (Array.isArray(value) && value.length === 0)

/**
 * Choosing a country fills in what the country list knows: its region, its
 * languages, and, when it is created, its name in the language being edited.
 * An editor's own values are kept, and a name an editor later clears stays
 * cleared, which takes the country off the site in that language.
 */
const fillFromList: CollectionBeforeValidateHook = ({ data, originalDoc, operation, req }) => {
  if (!data || !isCountryCode(data.code)) return data
  const defaults = countryDefaults(data.code)
  const value = (key: string): unknown => (key in data ? data[key] : originalDoc?.[key])
  const locale = isLocaleCode(req.locale) ? req.locale : DEFAULT_LOCALE
  return {
    ...data,
    ...(isEmpty(value('region')) ? { region: defaults.region } : {}),
    ...(isEmpty(value('languages')) ? { languages: defaults.languages } : {}),
    ...(isEmpty(value('defaultLanguage')) ? { defaultLanguage: defaults.defaultLanguage } : {}),
    ...(operation === 'create' && isEmpty(value('name'))
      ? { name: countryName(data.code, locale) }
      : {}),
  }
}

const FILLING_NAMES = 'promisetracker:fillingCountryNames'

/**
 * A save writes one language. After a country is added, or its code changes,
 * this fills its standard name in every other language that has none.
 */
const fillNamesInEveryLanguage: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context[FILLING_NAMES] || !isCountryCode(doc.code)) return doc
  if (operation === 'update' && previousDoc?.code === doc.code) return doc
  // A copy of the request, so reading and writing every language here does not
  // switch the caller's request to every language. It shares the transaction.
  const local = { ...req } as PayloadRequest
  const stored: unknown = await req.payload.findByID({
    collection: 'countries',
    id: doc.id,
    locale: 'all',
    depth: 0,
    // The system fills names it knows, whoever saved the country.
    overrideAccess: true,
    req: local,
  })
  const name: unknown = stored && typeof stored === 'object' ? Reflect.get(stored, 'name') : null
  const current = name && typeof name === 'object' ? (name as Record<string, unknown>) : {}
  const names = countryNames(doc.code)
  const missing = Object.fromEntries(
    Object.entries(names).filter(([locale]) => isEmpty(current[locale])),
  )
  if (Object.keys(missing).length === 0) return doc
  for (const [locale, value] of Object.entries(missing)) {
    if (!isLocaleCode(locale)) continue
    await req.payload.update({
      collection: 'countries',
      id: doc.id,
      locale,
      data: { name: value },
      // As above: these are names from the country list, not anyone's edit.
      overrideAccess: true,
      context: { [FILLING_NAMES]: true },
      req: { ...req } as PayloadRequest,
    })
  }
  return doc
}

/**
 * A country (section 7.1). An administrator picks it from the list of
 * African countries, and its names, region and languages are filled in.
 * Its code is part of every address on the site. Only super-admins manage
 * countries (section 13.2).
 *
 * The root area arrives with areas in #645, which adds the field.
 */
export const Countries: CollectionConfig = withPublishing(
  {
    slug: 'countries',
    admin: {
      useAsTitle: 'name',
      defaultColumns: ['name', 'code', 'region', 'recordStatus', 'publishedIn'],
    },
    access: {
      read: readReadyOrStaff,
      create: can.manageStructure,
      update: can.manageStructure,
      delete: can.manageStructure,
    },
    hooks: {
      beforeValidate: [fillFromList],
      afterChange: [fillNamesInEveryLanguage, cacheHooks.afterChange],
      afterDelete: [cacheHooks.afterDelete],
    },
    fields: [
      {
        // Stored as the code, chosen by name. It never changes once saved, since
        // it is part of every address on the site.
        name: 'code',
        label: 'Country',
        type: 'select',
        required: true,
        unique: true,
        index: true,
        options: COUNTRY_CODES.map((code) => ({
          label: countryName(code, DEFAULT_LOCALE),
          value: code,
        })).sort((a, b) => a.label.localeCompare(b.label)),
        access: { update: () => false },
        admin: {
          description:
            'Its name in every language, its region and its languages are filled in when you save.',
        },
      },
      {
        name: 'codeShown',
        label: 'Code',
        type: 'text',
        // Not stored. Shows the code beside the form, as it appears in addresses.
        virtual: true,
        admin: {
          position: 'sidebar',
          readOnly: true,
          description: 'Used in addresses, such as /en/ke.',
        },
        hooks: {
          afterRead: [
            ({ siblingData }) => (typeof siblingData.code === 'string' ? siblingData.code : null),
          ],
        },
      },
      {
        name: 'name',
        type: 'text',
        localized: true,
        admin: {
          description: 'Filled in from the country list. Change it to use another name.',
        },
      },
      {
        name: 'region',
        type: 'select',
        options: REGIONS.map((value) => ({ label: value, value })),
        admin: { position: 'sidebar', readOnly: true, description: 'From the country list.' },
      },
      {
        name: 'languages',
        type: 'select',
        hasMany: true,
        options: LANGUAGE_OPTIONS,
        admin: {
          description:
            'The languages this country publishes in. Filled in from the country list when left empty.',
        },
      },
      {
        name: 'defaultLanguage',
        type: 'select',
        options: LANGUAGE_OPTIONS,
        admin: { description: 'One of the languages above.' },
        validate: (value: unknown, { siblingData }: { siblingData: { languages?: unknown } }) => {
          if (isEmpty(value)) return true
          const languages = Array.isArray(siblingData.languages) ? siblingData.languages : []
          return languages.includes(value) ? true : 'Choose one of the languages above.'
        },
      },
      { name: 'about', type: 'textarea', localized: true },
    ],
  },
  ['name'],
)
