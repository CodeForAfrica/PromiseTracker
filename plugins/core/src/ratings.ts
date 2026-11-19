import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  FieldHook,
  PayloadRequest,
} from 'payload'
import { APIError, ValidationError } from 'payload'

import { access, signedIn } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { refreshOnChange } from './cache'
import { isHexColour } from './contrast'

/**
 * Rating scales and claim types (section 7.4, D22). Editors define ratings,
 * so nothing outside this file knows how many there are or what they are
 * called. A new installation gets the Delivery scale and the Promise claim
 * type from a migration.
 */

/** A claim that carries a rating. Enough for an editor to find it. */
export type RatingUse = { id: string; title: string }

/** Finds the claims that carry a rating. */
export type RatingUsage = (args: {
  req: PayloadRequest
  scale: string
  rating: string
}) => Promise<RatingUse[]>

// Claims arrive with #648, which sets the real lookup. Until then nothing carries a rating.
let ratingUsage: RatingUsage = async () => []

/** Sets how claims carrying a rating are found. The claims record type calls this. */
export function setRatingUsage(next: RatingUsage): void {
  ratingUsage = next
}

/** The claims that carry a rating, so it is not deleted while in use and can be re-rated when retired. */
export function claimsWithRating(
  req: PayloadRequest,
  scale: string,
  rating: string,
): Promise<RatingUse[]> {
  return ratingUsage({ req, scale, rating })
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type Row = Record<string, unknown>
type FieldError = { path: string; message: string }

const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((row): row is Row => Boolean(row) && typeof row === 'object')
    : []

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/**
 * The rules a scale keeps, as field errors. A slug never changes once saved,
 * because claims and their history refer to ratings by slug.
 */
export function checkScale(data: Row, previous: Row | undefined): FieldError[] {
  const errors: FieldError[] = []
  const tiers = rows(data.tiers)
  const ratings = rows(data.ratings)

  const tierSlugs = new Set<string>()
  tiers.forEach((tier, i) => {
    const slug = str(tier.slug)
    if (!slug || !SLUG.test(slug)) {
      errors.push({
        path: `tiers.${i}.slug`,
        message: 'Use lower-case letters, digits and hyphens.',
      })
    } else if (tierSlugs.has(slug)) {
      errors.push({ path: `tiers.${i}.slug`, message: `Another tier is already "${slug}".` })
    } else {
      tierSlugs.add(slug)
    }
  })

  const best = num(data.bestValue)
  const worst = num(data.worstValue)
  if (best !== null && worst !== null && best === worst) {
    errors.push({ path: 'bestValue', message: 'The best and worst values must differ.' })
  }
  const [low, high] =
    best !== null && worst !== null ? [Math.min(best, worst), Math.max(best, worst)] : [null, null]

  const previousSlugs = new Map(
    rows(previous?.ratings).flatMap((row) => {
      const id = str(row.id)
      const slug = str(row.slug)
      return id && slug ? [[id, slug] as const] : []
    }),
  )
  const ratingSlugs = new Set<string>()
  const starting: number[] = []
  ratings.forEach((rating, i) => {
    const at = (field: string) => `ratings.${i}.${field}`
    const slug = str(rating.slug)
    const before = previousSlugs.get(str(rating.id) ?? '')
    if (before !== undefined && slug !== before) {
      errors.push({
        path: at('slug'),
        message: `A rating's slug never changes. Keep "${before}", or add a new rating and retire this one.`,
      })
    } else if (!slug || !SLUG.test(slug)) {
      errors.push({ path: at('slug'), message: 'Use lower-case letters, digits and hyphens.' })
    } else if (ratingSlugs.has(slug)) {
      errors.push({ path: at('slug'), message: `Another rating is already "${slug}".` })
    } else {
      ratingSlugs.add(slug)
    }
    const tier = str(rating.tier)
    if (!tier || !tierSlugs.has(tier)) {
      errors.push({ path: at('tier'), message: 'Give the slug of one of the tiers above.' })
    }
    const value = num(rating.value)
    if (value !== null && low !== null && high !== null && (value < low || value > high)) {
      errors.push({ path: at('value'), message: `Give a value from ${low} to ${high}.` })
    }
    if (rating.isStarting === true) starting.push(i)
  })

  if (ratings.length > 0 && starting.length !== 1) {
    errors.push({
      path: starting.length === 0 ? 'ratings.0.isStarting' : `ratings.${starting[1]}.isStarting`,
      message: 'Exactly one rating is the starting rating, which every new claim begins with.',
    })
  }
  for (const i of starting) {
    if (ratings[i]?.retired === true) {
      errors.push({
        path: `ratings.${i}.retired`,
        message:
          'The starting rating cannot be retired. Make another rating the starting one first.',
      })
    }
  }
  return errors
}

const listClaims = (claims: readonly RatingUse[]): string =>
  claims
    .slice(0, 10)
    .map((c) => `"${c.title}"`)
    .join(', ') + (claims.length > 10 ? ` and ${claims.length - 10} more` : '')

/** Keeps a scale valid, and refuses to remove a rating that claims still carry. */
const guardScale: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  const errors = checkScale(data, originalDoc)
  if (operation === 'update' && originalDoc) {
    const kept = new Set(rows(data.ratings).map((row) => str(row.slug)))
    for (const removed of rows(originalDoc.ratings)) {
      const slug = str(removed.slug)
      if (!slug || kept.has(slug)) continue
      const claims = await claimsWithRating(req, String(originalDoc.id), slug)
      if (claims.length > 0) {
        errors.push({
          path: 'ratings',
          message: `"${slug}" is the rating of ${claims.length} claim(s): ${listClaims(claims)}. Retire it instead.`,
        })
      }
    }
  }
  if (errors.length > 0) throw new ValidationError({ collection: 'rating-scales', errors, req })
  return data
}

/** A scale in use by a claim type, or whose ratings claims carry, cannot be deleted. */
const guardScaleDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const types = await req.payload.find({
    collection: 'claim-types',
    where: { ratingScale: { equals: id } },
    depth: 0,
    limit: 10,
    // Checking what refers to the scale, whoever may read claim types.
    overrideAccess: true,
    req,
  })
  if (types.totalDocs > 0) {
    const names = types.docs.map((t) => `"${t.name ?? t.slug}"`).join(', ')
    // A refused delete has no field to mark, so the reason goes in the message itself.
    throw new APIError(`Claim types use this scale: ${names}. Change them first.`, 400, null, true)
  }
  const scale = await req.payload.findByID({
    collection: 'rating-scales',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const rating of rows(scale.ratings)) {
    const slug = str(rating.slug)
    if (!slug) continue
    const claims = await claimsWithRating(req, String(id), slug)
    if (claims.length > 0) {
      throw new APIError(
        `"${slug}" is the rating of ${claims.length} claim(s): ${listClaims(claims)}.`,
        400,
        null,
        true,
      )
    }
  }
}

/** Lists the claims a retired rating is still given to, for editors to re-rate. Staff only. */
const listClaimsWithRating: FieldHook = async ({ siblingData, data, req }) => {
  const slug = str(siblingData.slug)
  const scale = data?.id
  if (siblingData.retired !== true || !slug || scale === undefined || !signedIn({ req })) {
    return null
  }
  const claims = await claimsWithRating(req, String(scale), slug)
  return claims.length === 0
    ? 'No claims carry this rating.'
    : claims.map((c) => `${c.title} (${c.id})`).join('\n')
}

const colourField = (name: string, label: string) =>
  ({
    name,
    label,
    type: 'text',
    required: true,
    admin: { width: '33%', placeholder: '#1b4fd8' },
    validate: (value: unknown) =>
      isHexColour(value) ? true : 'Give a colour as # and six hex digits, such as #1b4fd8.',
  }) as const

const ratingTags = () => ['site', 'ratings']
const cacheHooks = refreshOnChange(ratingTags)

// Ratings and their definitions are public: the site explains every rating it shows.
const ratingAccess = { ...access.ratings, read: () => true }

export const RatingScales: CollectionConfig = {
  slug: 'rating-scales',
  labels: { singular: 'Rating scale', plural: 'Rating scales' },
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'name',
    description:
      'The ratings claims are given, grouped in tiers. Changing a rating changes it on every claim that carries it.',
  },
  access: ratingAccess,
  // Every change to a rating's label or definition is kept (section 7.4).
  versions: { maxPerDoc: 0 },
  hooks: {
    beforeChange: [guardScale],
    beforeDelete: [guardScaleDelete],
    afterChange: [cacheHooks.afterChange],
    afterDelete: [cacheHooks.afterDelete],
  },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'bestValue',
          type: 'number',
          required: true,
          admin: { width: '50%', description: 'The value of the best rating, for search engines.' },
        },
        {
          name: 'worstValue',
          type: 'number',
          required: true,
          admin: { width: '50%', description: 'The value of the worst rating.' },
        },
      ],
    },
    {
      name: 'tiers',
      type: 'array',
      minRows: 1,
      admin: {
        description: 'Groups of ratings, in the order the site shows them.',
        initCollapsed: true,
        components: { RowLabel: '@promisetracker/plugin-core/client#TierRowLabel' },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'slug',
              type: 'text',
              required: true,
              admin: { width: '33%', description: 'Ratings name their tier by this.' },
            },
            {
              name: 'label',
              type: 'text',
              localized: true,
              required: true,
              admin: { width: '33%' },
            },
            colourField('colour', 'Colour'),
          ],
        },
      ],
    },
    {
      name: 'ratings',
      type: 'array',
      minRows: 1,
      admin: {
        description: 'In the order the site lists them within their tier.',
        initCollapsed: true,
        components: { RowLabel: '@promisetracker/plugin-core/client#RatingRowLabel' },
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'slug',
              type: 'text',
              required: true,
              admin: {
                width: '33%',
                description: 'Never changes once saved, such as in-progress.',
              },
            },
            {
              name: 'label',
              type: 'text',
              localized: true,
              required: true,
              admin: { width: '33%' },
            },
            {
              name: 'tier',
              type: 'text',
              required: true,
              admin: { width: '33%', description: 'The slug of one of the tiers above.' },
            },
          ],
        },
        {
          name: 'definition',
          type: 'textarea',
          localized: true,
          required: true,
          admin: {
            description:
              'Edit the wording only. A change of meaning is a new rating. Every change is kept in the history.',
          },
        },
        {
          type: 'row',
          fields: [
            colourField('colour', 'Colour'),
            colourField('textColour', 'Text colour'),
            {
              name: 'value',
              type: 'number',
              required: true,
              admin: { width: '33%', description: 'Between the worst and best values.' },
            },
          ],
        },
        {
          name: 'contrast',
          type: 'ui',
          admin: { components: { Field: '@promisetracker/plugin-core/client#RatingContrast' } },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'needsDeadline',
              label: 'Needs a deadline',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                width: '33%',
                description: 'A claim with this rating must have a deadline.',
              },
            },
            {
              name: 'isStarting',
              label: 'Starting rating',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%', description: 'Every new claim begins with this rating.' },
            },
            {
              name: 'retired',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%', description: 'No new claim can be given this rating.' },
            },
          ],
        },
        {
          name: 'claimsWithRating',
          label: 'Claims still carrying this rating',
          type: 'textarea',
          virtual: true,
          admin: {
            readOnly: true,
            condition: (_, siblingData) => siblingData?.retired === true,
            description: 'Re-rate each through a claim update.',
          },
          hooks: { afterRead: [listClaimsWithRating] },
        },
      ],
    },
  ],
}

export const ClaimTypes: CollectionConfig = {
  slug: 'claim-types',
  labels: { singular: 'Claim type', plural: 'Claim types' },
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'ratingScale', 'hasDeadline'],
  },
  access: ratingAccess,
  hooks: { afterChange: [cacheHooks.afterChange], afterDelete: [cacheHooks.afterDelete] },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (value: unknown) =>
        typeof value === 'string' && SLUG.test(value)
          ? true
          : 'Use lower-case letters, digits and hyphens.',
    },
    { name: 'ratingScale', type: 'relationship', relationTo: 'rating-scales', required: true },
    {
      name: 'hasDeadline',
      label: 'Usually has a deadline',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Whether claims of this type usually have a deadline.' },
    },
  ],
}
