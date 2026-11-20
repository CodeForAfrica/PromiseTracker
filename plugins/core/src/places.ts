import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { afterCommit } from './afterCommit'
import { refreshTags } from './cache'
import { related, relatedSection } from './joins'
import { DEFAULT_LOCALE } from './locales'
import { withPublishing, withTrash } from './publishing'
import { slugify, slugProblem } from './slugs'
import { termTitle } from './termTitle'

/** The kinds of area in a country's nested list (section 7.2). */
export const AREA_TYPES = [
  'country',
  'region',
  'county',
  'constituency',
  'ward',
  'city',
  'other',
] as const
export type AreaType = (typeof AREA_TYPES)[number]

/** When an area has its own page (section 7.2). */
export const AREA_PAGE = ['automatic', 'always', 'never'] as const

export const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  if (value && typeof value === 'object') {
    const id: unknown = Reflect.get(value, 'id')
    return typeof id === 'string' ? id : null
  }
  return null
}

/** Staff read every area and office. A guest reads those of countries marked ready. */
const readPlaces = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || { 'country.recordStatus': { equals: 'ready' } }

/** The country's code, for the cache tags of its places. */
export async function countryCode(req: PayloadRequest, country: unknown): Promise<string | null> {
  const id = idOf(country)
  if (!id) return null
  const doc = await req.payload.findByID({
    collection: 'countries',
    joins: false,
    id,
    depth: 0,
    // Reads the country's code only, to name the pages to refresh.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return typeof doc.code === 'string' ? doc.code : null
}

/**
 * A change to an area or an office refreshes every page of its country's
 * places: area pages, area lists and office lists (section 17).
 */
const refreshPlaces = async ({
  doc,
  previousDoc,
  req,
}: {
  doc: { country?: unknown }
  previousDoc?: { country?: unknown }
  req: PayloadRequest
}) => {
  const codes = new Set(
    [await countryCode(req, doc.country), await countryCode(req, previousDoc?.country)].filter(
      (code): code is string => code !== null,
    ),
  )
  if (codes.size > 0)
    await refreshTags(
      [...codes].map((code) => `places:${code}`),
      req,
    )
  return doc
}

/** A slug from the name when none is given. */
export const slugFromName: CollectionBeforeValidateHook = ({ data }) => {
  if (!data || data.slug) return data
  const name = typeof data.name === 'string' ? data.name : null
  return name ? { ...data, slug: slugify(name) } : data
}

async function otherWithSlug(
  req: PayloadRequest,
  collection: 'areas' | 'offices',
  country: string,
  slug: string,
  id: unknown,
  extra: Where = {},
): Promise<boolean> {
  const { totalDocs } = await req.payload.count({
    collection,
    where: {
      and: [
        { country: { equals: country } },
        { slug: { equals: slug } },
        ...(typeof id === 'string' ? [{ id: { not_equals: id } }] : []),
        extra,
      ],
    },
    // Checks whether a slug is taken, whoever is asking. No record is returned.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return totalDocs > 0
}

/** Offices whose seat address is `/{lang}/{cc}/{office}`: those for the whole country, or no area. */
const NATIONAL: Where = {
  or: [{ areaType: { equals: 'country' } }, { areaType: { exists: false } }],
}

/**
 * An area's slug shares the space after `/{lang}/{cc}/` with national offices
 * and the site's own words, so it must not clash with either (section 11.2).
 */
const checkAreaSlug: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = data.slug ?? originalDoc?.slug
  const country = idOf(data.country ?? originalDoc?.country)
  const problem = slugProblem(slug)
  if (problem) throw new APIError(problem, 400)
  if (!country) return data
  if (await otherWithSlug(req, 'areas', country, slug, originalDoc?.id)) {
    throw new APIError(`Another area in this country already uses "${slug}".`, 400)
  }
  if (await otherWithSlug(req, 'offices', country, slug, undefined, NATIONAL)) {
    throw new APIError(`"${slug}" is a national office's address in this country.`, 400)
  }
  return data
}

const checkOfficeSlug: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = data.slug ?? originalDoc?.slug
  const country = idOf(data.country ?? originalDoc?.country)
  const problem = slugProblem(slug)
  if (problem) throw new APIError(problem, 400)
  if (!country) return data
  if (await otherWithSlug(req, 'offices', country, slug, originalDoc?.id)) {
    throw new APIError(`Another office in this country already uses "${slug}".`, 400)
  }
  const areaType = data.areaType === undefined ? originalDoc?.areaType : data.areaType
  const national = !areaType || areaType === 'country'
  if (national && (await otherWithSlug(req, 'areas', country, slug, undefined))) {
    throw new APIError(`"${slug}" is an area's address in this country.`, 400)
  }
  return data
}

/**
 * An area belongs to one country, and so does its parent. There is one area
 * for the whole country, of type country, at the top.
 */
const checkAreaPlace: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const country = idOf(data.country ?? originalDoc?.country)
  const parent = idOf(data.parent === undefined ? originalDoc?.parent : data.parent)
  const type = data.type ?? originalDoc?.type
  if (parent && country) {
    const parentDoc = await req.payload.findByID({
      collection: 'areas',
      joins: false,
      id: parent,
      depth: 0,
      // Reads the parent's country, to keep a country's areas together.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    if (idOf(parentDoc.country) !== country) {
      throw new APIError('An area’s parent must be in the same country.', 400)
    }
  }
  if (type === 'country') {
    if (parent) throw new APIError('The area for the whole country has no parent.', 400)
    const { totalDocs } = await req.payload.count({
      collection: 'areas',
      where: {
        and: [
          { country: { equals: country } },
          { type: { equals: 'country' } },
          ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
        ],
      },
      // Counts other whole-country areas, whoever is asking.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    if (totalDocs > 0)
      throw new APIError('This country already has an area for the whole country.', 400)
  }
  return data
}

/** The old slug is kept when a slug changes, so its address can redirect (section 11.2). */
export const keepFormerSlug: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const before = originalDoc?.slug
  if (!before || !data.slug || data.slug === before) return data
  const former: string[] = Array.isArray(originalDoc?.formerSlugs) ? originalDoc.formerSlugs : []
  return { ...data, formerSlugs: [...new Set([...former, before])].filter((s) => s !== data.slug) }
}

/**
 * A renamed actor or office renames their terms in the admin's lists. Only
 * the title is written, straight to the database: saving each term again
 * would run its checks, and an old term that today's rules would refuse
 * would block the rename.
 */
const retitleTerms = async (
  req: PayloadRequest,
  field: 'actor' | 'office',
  id: string,
): Promise<void> => {
  const { docs } = await req.payload.find({
    collection: 'terms',
    where: { [field]: { equals: id } },
    // The actor and office, for their names.
    depth: 1,
    locale: DEFAULT_LOCALE,
    pagination: false,
    // The system keeps the titles in step with the names.
    overrideAccess: true,
    req,
  })
  const nameOf = (value: unknown): string => {
    const name: unknown = value && typeof value === 'object' ? Reflect.get(value, 'name') : null
    return typeof name === 'string' ? name : ''
  }
  for (const term of docs) {
    const title = termTitle(nameOf(term.actor), nameOf(term.office), term.startsOn ?? null)
    if (title === term.title) continue
    await req.payload.db.updateOne({
      collection: 'terms',
      id: term.id,
      data: { title },
      req,
      returning: false,
    })
  }
}

/** Renaming an actor or an office updates the titles of the terms that name it. */
export const retitleOnRename =
  (field: 'actor' | 'office'): CollectionAfterChangeHook =>
  async ({ doc, previousDoc, req, operation }) => {
    if (operation !== 'update' || !previousDoc) return doc
    const name = (value: unknown) =>
      value && typeof value === 'object' ? Reflect.get(value, DEFAULT_LOCALE) : value
    // A localized name arrives in the language being edited. The title uses the default one.
    if (field === 'office' && req.locale && req.locale !== DEFAULT_LOCALE) return doc
    if (name(doc.name) !== name(previousDoc.name)) await retitleTerms(req, field, doc.id)
    return doc
  }

/**
 * Terms name areas and offices, and hold the history of who sat where, so an
 * area or office a term names is not deleted.
 */
export const keepWhileNamedInTerms =
  (field: 'area' | 'office'): CollectionBeforeDeleteHook =>
  async ({ id, req }) => {
    const { totalDocs } = await req.payload.count({
      collection: 'terms',
      where: { [field]: { equals: id } },
      // Counts the terms that name this record, whoever is deleting it.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    if (totalDocs > 0) {
      throw new APIError(`Terms name this ${field}. Delete or change those terms first.`, 400)
    }
  }

/** The whole-country area becomes the country's root area, unless one is already set. */
const linkRootArea = async ({
  doc,
  req,
}: {
  doc: { id: string; type?: unknown; country?: unknown }
  req: PayloadRequest
}) => {
  const country = idOf(doc.country)
  if (doc.type !== 'country' || !country) return doc
  await afterCommit(req, async () => {
    const current = await req.payload.findByID({
      collection: 'countries',
      joins: false,
      id: country,
      depth: 0,
      // The system links the root area it just saw saved.
      overrideAccess: true,
    })
    if (!idOf(current.rootArea)) {
      await req.payload.update({
        collection: 'countries',
        id: country,
        data: { rootArea: doc.id },
        overrideAccess: true,
      })
    }
  })
  return doc
}

export const countryField = {
  name: 'country',
  type: 'relationship',
  relationTo: 'countries',
  required: true,
  index: true,
  admin: { position: 'sidebar' },
} as const

/**
 * Made from the name on save, so the form does not ask for it. Not Payload's
 * own slug field: that one keeps slugs unique across every country, and a
 * slug here is unique within its country, so two countries can each have a
 * "central-region" (section 7.2). A save checks it in checkAreaSlug or
 * checkOfficeSlug.
 */
/** Slugs a record had before, so their addresses redirect (section 11.2). Set by keepFormerSlug. */
export const formerSlugsField = {
  name: 'formerSlugs',
  type: 'text',
  hasMany: true,
  admin: { position: 'sidebar', readOnly: true },
  access: { create: () => false, update: () => false },
} as const

export const slugField = {
  name: 'slug',
  type: 'text',
  index: true,
  admin: {
    position: 'sidebar',
    description:
      'Made from the name when you save. Used in addresses, such as /en/ke/nairobi-county.',
  },
} as const

/** A country's nested list of places (section 7.2). */
export const Areas: CollectionConfig = withPublishing(
  {
    slug: 'areas',
    admin: {
      group: ADMIN_GROUPS.places,
      useAsTitle: 'name',
      defaultColumns: ['name', 'type', 'slug', 'country'],
    },
    // Payload keeps the parent links and refuses a parent chain that loops.
    hierarchy: { parentFieldName: 'parent', slugField: 'slug' },
    access: {
      read: readPlaces,
      create: can.manageStructure,
      update: can.manageStructure,
      delete: can.manageStructure,
    },
    indexes: [{ fields: ['country', 'slug'], unique: true }],
    hooks: {
      beforeValidate: [slugFromName],
      beforeChange: [checkAreaSlug, checkAreaPlace, keepFormerSlug],
      beforeDelete: [keepWhileNamedInTerms('area')],
      afterChange: [linkRootArea, refreshPlaces],
      afterDelete: [refreshPlaces],
    },
    fields: [
      { name: 'name', type: 'text', localized: true, required: true },
      slugField,
      {
        name: 'type',
        type: 'select',
        required: true,
        options: AREA_TYPES.map((value) => ({ label: value, value })),
      },
      {
        name: 'parent',
        type: 'relationship',
        relationTo: 'areas',
        hasMany: false,
        index: true,
        admin: { description: 'The area it sits in.' },
      },
      {
        name: 'page',
        type: 'select',
        required: true,
        defaultValue: 'automatic',
        options: AREA_PAGE.map((value) => ({ label: value, value })),
        admin: {
          description: 'Automatic gives the area a page when two or more seats answer for it.',
        },
      },
      countryField,
      { name: 'externalCode', type: 'text', admin: { position: 'sidebar' } },
      formerSlugsField,
      {
        // Collapsed: maps arrive in version 2, and most editors never need these.
        type: 'collapsible',
        label: 'Map',
        admin: { initCollapsed: true, description: 'For the maps in version 2.' },
        fields: [
          {
            name: 'geo',
            type: 'group',
            label: false,
            fields: [
              {
                type: 'row',
                fields: [
                  { name: 'latitude', type: 'number', min: -90, max: 90 },
                  { name: 'longitude', type: 'number', min: -180, max: 180 },
                ],
              },
              {
                name: 'bounds',
                type: 'json',
                admin: {
                  description:
                    'West, south, east and north, in degrees, such as [36.6, -1.45, 37.1, -1.16].',
                },
              },
              {
                name: 'outline',
                type: 'upload',
                relationTo: 'boundaries',
                admin: {
                  description:
                    'A GeoJSON file from Boundaries, which records its source and licence.',
                },
              },
            ],
          },
        ],
      },
      relatedSection(
        related({
          name: 'children',
          label: 'Areas in it',
          collection: 'areas',
          on: 'parent',
          // Payload cannot sort a join by a field with a value per language, such as the name.
          defaultSort: 'slug',
          columns: ['name', 'type', 'slug'],
        }),
        related({
          name: 'terms',
          label: 'Terms',
          collection: 'terms',
          on: 'area',
          defaultSort: '-startsOn',
          columns: ['title', 'party', 'startsOn', 'endsOn'],
        }),
      ),
    ],
  },
  ['name'],
  {
    // An area has no status of its own: it is live wherever its country is (section 8.1).
    status: false,
    drafts: false,
    parents: [{ field: 'country', collection: 'countries' }],
  },
)

/** A country's list of offices, such as Governor or Member of Parliament (section 7.2). */
export const Offices: CollectionConfig = withTrash({
  slug: 'offices',
  admin: {
    group: ADMIN_GROUPS.places,
    useAsTitle: 'name',
    defaultColumns: ['name', 'shortName', 'areaType', 'country'],
  },
  defaultSort: 'order',
  access: {
    read: readPlaces,
    create: can.manageStructure,
    update: can.manageStructure,
    delete: can.manageStructure,
  },
  indexes: [{ fields: ['country', 'slug'], unique: true }],
  hooks: {
    beforeValidate: [slugFromName],
    beforeChange: [checkOfficeSlug, keepFormerSlug],
    beforeDelete: [keepWhileNamedInTerms('office')],
    afterChange: [refreshPlaces, retitleOnRename('office')],
    afterDelete: [refreshPlaces],
  },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    { name: 'shortName', type: 'text', localized: true },
    slugField,
    {
      name: 'areaType',
      type: 'select',
      options: AREA_TYPES.map((value) => ({ label: value, value })),
      admin: {
        description:
          'The kind of area it answers for. Country for national offices, empty for offices with no area.',
      },
    },
    {
      name: 'holdersPerSeat',
      type: 'number',
      required: true,
      defaultValue: 1,
      min: 1,
      admin: { description: 'More than one for seats with several members.' },
    },
    {
      name: 'order',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Lower comes first. Put the highest office first.' },
    },
    countryField,
    formerSlugsField,
    relatedSection(
      related({
        name: 'terms',
        label: 'Holders',
        collection: 'terms',
        on: 'office',
        defaultSort: '-startsOn',
        columns: ['title', 'area', 'party', 'startsOn', 'endsOn'],
      }),
    ),
  ],
})
