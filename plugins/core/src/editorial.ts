import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { refreshOnChange, refreshTags } from './cache'
import { countryField, formerSlugsField, idOf, keepFormerSlug } from './places'
import { countryTags, withPublishing, withTrash } from './publishing'
import { pageSlugProblem, SLUG_PATTERN, slugify } from './slugs'

/**
 * Editorial content (section 7.7): themes, articles, editor pages, partners
 * and sister tools. Editors make them. The public site reads them through
 * `/api/v1`, and the homepage and country pages show them (section 10.2).
 */

/** Staff read everything. A guest reads what is marked ready, in a language it is published in. */
const readReady = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || { recordStatus: { equals: 'ready' } }

const valueIn = (data: Record<string, unknown>, original: unknown, key: string): unknown =>
  key in data
    ? data[key]
    : original && typeof original === 'object'
      ? Reflect.get(original, key)
      : undefined

/** A slug from the title when none is given, as claims have. */
const slugFromTitle: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data || data.slug) return data
  if (operation === 'update' && !('slug' in data)) return data
  const given = data.title ?? originalDoc?.title
  return typeof given === 'string' ? { ...data, slug: slugify(given) } : data
}

/** Refuses a slug another record of the same type already uses, within `scope`. */
async function slugTaken(
  req: PayloadRequest,
  collection: string,
  slug: string,
  scope: Where[],
  id: unknown,
): Promise<boolean> {
  const { totalDocs } = await req.payload.count({
    collection: collection as never,
    where: {
      and: [
        { slug: { equals: slug } },
        ...scope,
        ...(typeof id === 'string' ? [{ id: { not_equals: id } }] : []),
      ],
    },
    // Whether a slug is free is checked whoever is asking. Nothing is returned.
    overrideAccess: true,
    trash: true,
    req: { ...req } as PayloadRequest,
  })
  return totalDocs > 0
}

const checkSlug = (slug: unknown, example: string): string => {
  if (typeof slug !== 'string' || !slug) {
    throw new APIError(
      `A slug cannot be made from this title. Give one in the sidebar, such as ${example}.`,
      400,
    )
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new APIError(
      `Use lower-case letters, digits and single hyphens in the slug, such as ${example}.`,
      400,
    )
  }
  return slug
}

const slugSidebar = (description: string): Field => ({
  name: 'slug',
  type: 'text',
  index: true,
  admin: { position: 'sidebar', description },
})

// Themes

const checkTheme: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = checkSlug(valueIn(data, originalDoc, 'slug'), 'water-and-sanitation')
  if (await slugTaken(req, 'themes', slug, [], originalDoc?.id)) {
    throw new APIError(`Another theme uses "${slug}".`, 400)
  }
  return data
}

const themeRefresh = refreshOnChange(() => ['themes', 'site'])

/**
 * A subject an editor follows across countries, such as water and
 * sanitation, with the claims they picked (section 7.7).
 */
export const Themes: CollectionConfig = withPublishing(
  {
    slug: 'themes',
    labels: { singular: 'Theme', plural: 'Themes' },
    admin: {
      group: ADMIN_GROUPS.site,
      useAsTitle: 'title',
      defaultColumns: ['title', 'countries', 'recordStatus'],
      description: 'A subject followed across countries, with claims you pick.',
    },
    access: {
      read: readReady,
      create: can.editEditorial,
      update: can.editEditorial,
      delete: can.deleteRecords,
    },
    hooks: {
      beforeValidate: [slugFromTitle],
      beforeChange: [checkTheme, keepFormerSlug],
      afterChange: [themeRefresh.afterChange],
      afterDelete: [themeRefresh.afterDelete],
    },
    fields: [
      { name: 'title', type: 'text', localized: true, required: true },
      { name: 'introduction', type: 'textarea', localized: true },
      { name: 'image', type: 'upload', relationTo: 'media' },
      {
        name: 'claims',
        type: 'relationship',
        relationTo: 'claims',
        hasMany: true,
        admin: { description: 'In the order they show. Only published claims appear.' },
      },
      {
        name: 'countries',
        type: 'relationship',
        relationTo: 'countries',
        hasMany: true,
        admin: { description: 'The countries it covers. Its figures are shown for each.' },
      },
      slugSidebar('Made from the title. Used in addresses, such as /en/themes/water.'),
      formerSlugsField,
    ],
  },
  ['title'],
)

// Articles

/** What an article is about: a claim, an actor or a country, in the article's country. */
export const ABOUT_TYPES = ['claims', 'actors', 'countries'] as const

const checkArticle: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const country = idOf(valueIn(data, originalDoc, 'country'))
  const slug = checkSlug(valueIn(data, originalDoc, 'slug'), 'why-the-housing-money-stopped')
  if (
    country &&
    (await slugTaken(req, 'articles', slug, [{ country: { equals: country } }], originalDoc?.id))
  ) {
    throw new APIError(`Another article in this country uses "${slug}".`, 400)
  }
  const about = valueIn(data, originalDoc, 'about') as
    | { relationTo?: string; value?: unknown }
    | null
    | undefined
  const aboutId = idOf(about?.value)
  if (about?.relationTo && aboutId) {
    if (about.relationTo === 'countries') {
      if (aboutId !== country) throw new APIError('An article is about its own country.', 400)
    } else {
      const subject = await req.payload
        .findByID({
          collection: about.relationTo as 'claims' | 'actors',
          id: aboutId,
          depth: 0,
          select: { country: true },
          // Reads the subject's country only, to check it matches.
          overrideAccess: true,
          req,
        })
        .catch(() => null)
      if (!subject || idOf(subject.country) !== country) {
        throw new APIError('Choose a claim or actor in the article’s country.', 400)
      }
    }
  }
  return data
}

/**
 * Analysis written about a claim, an actor or a country (section 7.7). No
 * byline is a normal state, and an editor can hide one that is set.
 */
export const Articles: CollectionConfig = withPublishing(
  {
    slug: 'articles',
    labels: { singular: 'Article', plural: 'Articles' },
    admin: {
      group: ADMIN_GROUPS.site,
      useAsTitle: 'title',
      defaultColumns: ['title', 'country', 'date', 'recordStatus'],
      description: 'Analysis of a claim, an actor or a country. It shows as Latest analysis.',
    },
    access: {
      read: readReady,
      create: can.editEditorial,
      update: can.editEditorial,
      delete: can.deleteRecords,
    },
    // The latest first, within a country, for Latest analysis.
    indexes: [{ fields: ['country', 'slug'], unique: true }, { fields: ['country', 'date'] }],
    hooks: {
      beforeValidate: [slugFromTitle],
      beforeChange: [checkArticle, keepFormerSlug],
      // An article shows on its country's pages, so they refresh.
      afterChange: [
        async ({ doc, req }) => {
          await refreshTags(await countryTags(req.payload, 'articles', doc, req), req)
          return doc
        },
      ],
      afterDelete: [
        async ({ doc, req }) => {
          await refreshTags(await countryTags(req.payload, 'articles', doc, req), req)
          return doc
        },
      ],
    },
    fields: [
      { name: 'title', type: 'text', localized: true, required: true },
      {
        name: 'standfirst',
        type: 'textarea',
        localized: true,
        admin: { description: 'One or two sentences under the title.' },
      },
      { name: 'body', type: 'richText', localized: true },
      { name: 'image', type: 'upload', relationTo: 'media' },
      {
        name: 'about',
        type: 'relationship',
        relationTo: [...ABOUT_TYPES],
        required: true,
        index: true,
        admin: { description: 'The claim, actor or country it is about.' },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'date',
            type: 'date',
            required: true,
            index: true,
            admin: { date: { pickerAppearance: 'dayOnly' } },
          },
          {
            name: 'byline',
            type: 'text',
            admin: { description: 'Who wrote it. Leave empty for none.' },
          },
          {
            name: 'hideByline',
            label: 'Hide the byline',
            type: 'checkbox',
            defaultValue: false,
          },
        ],
      },
      countryField,
      slugSidebar('Made from the title. Used in addresses, such as /en/ke/a/water-for-kibra.'),
      formerSlugsField,
    ],
  },
  ['title'],
  { parents: [{ field: 'country', collection: 'countries' }] },
)

// Editor pages

/** The path from the top, such as `resources/guides`, from the parent's path and the slug. */
const setPath: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = valueIn(data, originalDoc, 'slug')
  const problem = pageSlugProblem(slug)
  if (problem) throw new APIError(problem, 400)
  const parentId = idOf(valueIn(data, originalDoc, 'parent'))
  if (parentId && parentId === originalDoc?.id)
    throw new APIError('A page cannot sit under itself.', 400)
  const parent = parentId
    ? await req.payload
        .findByID({
          collection: 'pages' as never,
          id: parentId,
          depth: 0,
          select: { path: true } as never,
          // Reads the parent's path only, to build this one.
          overrideAccess: true,
          req,
        })
        .catch(() => null)
    : null
  const above = parent ? Reflect.get(parent, 'path') : null
  const path = typeof above === 'string' && above ? `${above}/${String(slug)}` : String(slug)
  if (path.split('/').length > PAGE_DEPTH) {
    throw new APIError(`Pages nest at most ${PAGE_DEPTH} deep.`, 400)
  }
  const { totalDocs } = await req.payload.count({
    collection: 'pages' as never,
    where: {
      and: [
        { path: { equals: path } },
        ...(typeof originalDoc?.id === 'string' ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    // Whether the address is free is checked whoever is asking.
    overrideAccess: true,
    trash: true,
    req: { ...req } as PayloadRequest,
  })
  if (totalDocs > 0) throw new APIError(`Another page is at /${path}.`, 400)
  return { ...data, path }
}

/** A page moved or renamed moves the pages under it. */
const movePagesBelow = async ({
  doc,
  previousDoc,
  req,
}: {
  doc: Record<string, unknown>
  previousDoc?: Record<string, unknown>
  req: PayloadRequest
}) => {
  if (!previousDoc || doc.path === previousDoc.path) return doc
  const { docs } = await req.payload.find({
    collection: 'pages' as never,
    where: { parent: { equals: doc.id } },
    depth: 0,
    limit: 0,
    // The pages under a moved one move with it, whoever moved it.
    overrideAccess: true,
    trash: true,
    req,
  })
  for (const child of docs) {
    // Saving the child works out its path again, and moves its own children.
    await req.payload.update({
      collection: 'pages' as never,
      id: (child as { id: string }).id,
      data: {} as never,
      overrideAccess: true,
      trash: true,
      req,
    })
  }
  return doc
}

const pageRefresh = refreshOnChange(() => ['pages', 'site'])

/** How deep pages nest. An address stays short enough to read out. */
export const PAGE_DEPTH = 3

/**
 * Pages editors make, such as About, FAQ or the methodology (section 7.7),
 * nested. A page can instead be a marked link to a sister site.
 */
export const Pages: CollectionConfig = withPublishing(
  {
    slug: 'pages',
    labels: { singular: 'Page', plural: 'Pages' },
    admin: {
      group: ADMIN_GROUPS.site,
      useAsTitle: 'title',
      defaultColumns: ['title', 'path', 'recordStatus'],
      description: 'Pages such as About and Methodology, at /{language}/{page}.',
    },
    // Payload keeps the parent links and refuses a parent chain that loops.
    hierarchy: { parentFieldName: 'parent', slugField: 'slug' },
    // Editors set the order pages are listed in, under their parent.
    orderable: true,
    access: {
      read: readReady,
      create: can.editEditorial,
      update: can.editEditorial,
      delete: can.deleteRecords,
    },
    hooks: {
      beforeValidate: [slugFromTitle],
      beforeChange: [setPath],
      // A page changes the site's menus and its own address, so both refresh.
      afterChange: [movePagesBelow as never, pageRefresh.afterChange],
      afterDelete: [pageRefresh.afterDelete],
    },
    fields: [
      { name: 'title', type: 'text', localized: true, required: true },
      {
        name: 'summary',
        type: 'textarea',
        localized: true,
        admin: { description: 'One line, under the title and in lists of pages.' },
      },
      {
        name: 'body',
        type: 'richText',
        localized: true,
        admin: { condition: (data) => !data?.link },
      },
      {
        name: 'link',
        label: 'Link to a sister site',
        type: 'text',
        admin: {
          description:
            'Makes the page a marked link instead: its address leads to this site, and menus mark it as leaving PromiseTracker.',
        },
        validate: (value: unknown) =>
          value === null || value === undefined || value === ''
            ? true
            : typeof value === 'string' && /^https:\/\/\S+$/.test(value)
              ? true
              : 'Give a full https:// address.',
      },
      {
        name: 'parent',
        type: 'relationship',
        relationTo: 'pages',
        hasMany: false,
        index: true,
        admin: { position: 'sidebar', description: 'The page it sits under, if any.' },
      },
      slugSidebar('Made from the title. Not two letters, which are for countries.'),
      {
        name: 'path',
        type: 'text',
        index: true,
        admin: {
          position: 'sidebar',
          readOnly: true,
          description: 'Its address after the language, worked out on save.',
        },
        access: { create: () => false, update: () => false },
      },
    ],
  },
  ['title'],
)

// Partners and sister tools

const siteRefresh = refreshOnChange(() => ['site'])

const linkField: Field = {
  name: 'url',
  label: 'Link',
  type: 'text',
  required: true,
  validate: (value: unknown) =>
    typeof value === 'string' && /^https:\/\/\S+$/.test(value)
      ? true
      : 'Give a full https:// address.',
}

/** Organisations PromiseTracker works with, for "Who we work with" (section 10.2). */
export const Partners: CollectionConfig = withTrash({
  slug: 'partners',
  labels: { singular: 'Partner', plural: 'Partners' },
  admin: { group: ADMIN_GROUPS.site, useAsTitle: 'name', defaultColumns: ['name', 'url'] },
  orderable: true,
  access: {
    read: () => true,
    create: can.editEditorial,
    update: can.editEditorial,
    delete: can.deleteRecords,
  },
  hooks: { afterChange: [siteRefresh.afterChange], afterDelete: [siteRefresh.afterDelete] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    linkField,
    {
      name: 'countries',
      type: 'relationship',
      relationTo: 'countries',
      hasMany: true,
      admin: { description: 'Where they work with us. Empty for everywhere.' },
    },
  ],
})

/** Other tools from PesaCheck (section 10.2). */
export const SisterTools: CollectionConfig = withTrash({
  slug: 'sister-tools',
  labels: { singular: 'Sister tool', plural: 'Sister tools' },
  admin: { group: ADMIN_GROUPS.site, useAsTitle: 'name', defaultColumns: ['name', 'url'] },
  orderable: true,
  access: {
    read: () => true,
    create: can.editEditorial,
    update: can.editEditorial,
    delete: can.deleteRecords,
  },
  hooks: { afterChange: [siteRefresh.afterChange], afterDelete: [siteRefresh.afterDelete] },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'description', type: 'text', localized: true },
    linkField,
  ],
})
