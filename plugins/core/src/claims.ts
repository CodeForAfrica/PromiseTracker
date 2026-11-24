import type { Verdict } from '@promisetracker/kernel'
import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Field,
  Payload,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn, userCan } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { refreshTags } from './cache'
import { isHexColour } from './contrast'
import { countryCode, countryField, formerSlugsField, idOf, keepFormerSlug } from './places'
import type { PublishingCheck } from './publishing'
import { withPublishing, withTrash } from './publishing'
import { setClaimTypeUsage, setRatingUsage } from './ratings'
import { SLUG_PATTERN, slugify } from './slugs'
import {
  confirmRating,
  deleteClaimHistory,
  fromLiveClaim,
  publishedAnywhere,
  ratingFromUpdates,
} from './updates'

/**
 * Claims and topics (sections 7.5 and 7.7). A claim is what an actor said
 * they would do, rated on its claim type's scale. Topics are shared by every
 * country.
 */

/**
 * A partial date: a year, a month or a day, written `2027`, `2027-08` or
 * `2027-08-09`. Claims are often made or due "in 2027" or "by August". Written
 * this way they also sort in date order as text.
 */
export const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

export type DatePrecision = 'year' | 'month' | 'day'

/** How precise a partial date is, or null when it is not one. */
export function partialDatePrecision(value: unknown): DatePrecision | null {
  if (typeof value !== 'string') return null
  const match = PARTIAL_DATE.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  if (month === undefined) return 'year'
  const m = Number(month)
  if (m < 1 || m > 12) return null
  if (day === undefined) return 'month'
  const d = Number(day)
  if (d < 1 || d > 31) return null
  // An impossible day, such as 30 February, rolls over into the next month.
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? 'day' : null
}

const partialDate = (name: string, description: string) =>
  ({
    name,
    type: 'text',
    index: true,
    admin: { description, placeholder: '2027, 2027-08 or 2027-08-09' },
    validate: (value: unknown) =>
      value === null || value === undefined || value === '' || partialDatePrecision(value)
        ? true
        : 'Give a year, a year and month, or a full date: 2027, 2027-08 or 2027-08-09.',
  }) as const

/** How a claim was found (section 7.5). */
export const EXTRACTIONS = ['manual', 'import', 'ai'] as const

/** Topics are public: they label claims on every page. */
const readTopics = () => true

/** Staff read every claim. A guest reads those marked ready, by an actor and in a country marked ready. */
const readClaims = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || {
    and: [
      { recordStatus: { equals: 'ready' } },
      { 'country.recordStatus': { equals: 'ready' } },
      { 'actor.recordStatus': { equals: 'ready' } },
    ],
  }

/** A slug from the title when none is given. The title is in the language being edited. */
const slugFromTitle: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data || data.slug) return data
  // On an update, only a slug cleared on purpose is made again. A save that
  // sends a new title and no slug keeps the address.
  if (operation === 'update' && !('slug' in data)) return data
  // A cleared slug with no new title is made from the saved one.
  const given = data.title ?? originalDoc?.title
  const title = typeof given === 'string' ? given : null
  return title ? { ...data, slug: slugify(title) } : data
}

const slugFromName: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data || data.slug) return data
  if (operation === 'update' && !('slug' in data)) return data
  const given = data.name ?? originalDoc?.name
  const name = typeof given === 'string' ? given : null
  return name ? { ...data, slug: slugify(name) } : data
}

type Ref = { id: string; country?: unknown; actor?: unknown; parent?: unknown } & Record<
  string,
  unknown
>

/** One record by id, read as the system, for the checks on a claim. */
async function load(
  req: PayloadRequest,
  collection: 'actors' | 'areas' | 'terms' | 'topics' | 'claim-types' | 'rating-scales',
  value: unknown,
): Promise<Ref | null> {
  const id = idOf(value)
  if (!id) return null
  const { docs } = await req.payload.find({
    collection,
    where: { id: { equals: id } },
    depth: 0,
    limit: 1,
    // Reads the records a claim names, to check they fit together.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return (docs[0] as Ref | undefined) ?? null
}

const valueIn = (data: Record<string, unknown>, original: unknown, key: string): unknown =>
  key in data
    ? data[key]
    : original && typeof original === 'object'
      ? Reflect.get(original, key)
      : undefined

/** The claim type a claim without one gets: Promise (section 7.5). */
async function defaultType(req: PayloadRequest): Promise<string | null> {
  const { docs } = await req.payload.find({
    collection: 'claim-types',
    where: { slug: { equals: 'promise' } },
    depth: 0,
    limit: 1,
    // The installation's own claim type, whoever saves the claim.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const id = docs[0]?.id
  return id === undefined ? null : String(id)
}

/** The ratings of a claim type's scale, and the one a new claim starts on (section 7.4). */
async function typeRatings(
  req: PayloadRequest,
  type: string,
): Promise<{ starting: string | null; slugs: Set<string> }> {
  const claimType = await load(req, 'claim-types', type)
  const scale = await load(req, 'rating-scales', claimType?.ratingScale)
  const ratings = Array.isArray(scale?.ratings) ? (scale.ratings as Record<string, unknown>[]) : []
  const start = ratings.find((r) => r.isStarting === true && r.retired !== true)
  return {
    starting: typeof start?.slug === 'string' ? start.slug : null,
    slugs: new Set(ratings.map((r) => r.slug).filter((s): s is string => typeof s === 'string')),
  }
}

/**
 * A claim's actor, co-actors, term and area are in one country, which the
 * claim takes from its actor. A new claim starts on its type's starting
 * rating, and records who entered it.
 */
const checkClaim: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  const get = (key: string) => valueIn(data, originalDoc, key)
  const actor = await load(req, 'actors', get('actor'))
  if (!actor) throw new APIError('Choose the actor who made this claim.', 400)
  const country = idOf(actor.country)
  // A claim's address, its former slugs and its figures belong to its country,
  // so a new actor must be in the same one.
  const before = idOf(originalDoc?.country)
  if (before && before !== country) {
    throw new APIError(
      'A claim stays in its country. Choose an actor in the same country, or add the claim again in the other one.',
      400,
    )
  }
  const sameCountry = (ref: Ref | null, what: string) => {
    if (ref && idOf(ref.country) !== country) {
      throw new APIError(`The ${what} must be in the actor's country.`, 400)
    }
  }
  const coActors = Array.isArray(get('coActors')) ? (get('coActors') as unknown[]) : []
  for (const co of coActors) sameCountry(await load(req, 'actors', co), 'co-actor')
  sameCountry(await load(req, 'areas', get('area')), 'area')
  const term = await load(req, 'terms', get('term'))
  if (term && idOf(term.actor) !== actor.id) {
    throw new APIError('The term must be one the actor held.', 400)
  }

  const slug = get('slug')
  if (typeof slug !== 'string' || !slug) {
    // A title in a script with no Latin letters makes no slug.
    throw new APIError(
      'A slug cannot be made from this title. Give one in the sidebar, such as kibra-housing.',
      400,
    )
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new APIError(
      'Use lower-case letters, digits and single hyphens in the slug, such as kibra-housing.',
      400,
    )
  }
  const { totalDocs } = await req.payload.count({
    collection: 'claims',
    where: {
      and: [
        { country: { equals: country } },
        { slug: { equals: slug } },
        ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
      ],
    },
    // Checks whether a slug is taken, whoever is asking. No record is returned.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  if (totalDocs > 0) throw new APIError(`Another claim in this country uses "${slug}".`, 400)

  const next: Record<string, unknown> = { ...data, country }
  const type = idOf(get('type')) ?? (await defaultType(req))
  if (!type) throw new APIError('Choose the claim type.', 400)
  next.type = type
  if (operation === 'create') {
    const { starting } = await typeRatings(req, type)
    if (!starting) throw new APIError('The claim type’s scale has no starting rating.', 400)
    // These fields refuse values from editors, but Payload applies field
    // access before this hook runs, so the system's values are kept. A test
    // creates a claim as an editor to prove it.
    next.currentRating = starting
    next.updateCount = 0
    if (req.user) next.enteredBy = req.user.id
  } else if (idOf(originalDoc?.type) !== type) {
    // A new type can mean a new scale, which may not have the claim's rating.
    const { starting, slugs } = await typeRatings(req, type)
    const rating = originalDoc?.currentRating
    if (typeof rating !== 'string' || !slugs.has(rating)) {
      if (Number(originalDoc?.updateCount ?? 0) > 0) {
        throw new APIError(
          `This claim's rating, "${String(rating)}", is not on the new type's scale. Re-rate it through a claim update first.`,
          400,
        )
      }
      if (!starting) throw new APIError('The claim type’s scale has no starting rating.', 400)
      // Nothing has rated it yet, so it starts on the new scale.
      next.currentRating = starting
    }
  }
  return next
}

/** A fact-checker's finding on a claim (section 7.5). Only verified claims are published. */
export const VERDICTS = [
  'unverified',
  'verified',
  'false',
  'misleading',
] as const satisfies readonly Verdict[]

/** The claim's verdict, unverified until someone sets one. */
export const verdictOf = (claim: Record<string, unknown>): Verdict => {
  const verdict: unknown = asRecordOf(claim.verification).verdict
  return (VERDICTS as readonly unknown[]).includes(verdict) ? (verdict as Verdict) : 'unverified'
}

const asRecordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const FOUND_FALSE: readonly Verdict[] = ['false', 'misleading']

/** Only reviewers, editors and super-admins set a verdict (section 13.2). */
const verdictAccess = { create: can.setVerdict, update: can.setVerdict }

/**
 * The verification (sections 5.1 and 7.5). Its verdict, date and rationale are
 * named so a verification plugin can take them over through `takesOver`, as
 * `verification.verdict`, `verification.date` and `verification.rationale`.
 * Who verified a claim is internal: only staff read it (section 13).
 */
const verificationField: Field = {
  name: 'verification',
  type: 'group',
  admin: {
    description: 'Check the statement against the source, then set the verdict.',
  },
  fields: [
    {
      name: 'quote',
      type: 'ui',
      admin: { components: { Field: '@promisetracker/plugin-core/client#SourceQuote' } },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'verdict',
          type: 'select',
          // Not required: a claim with none is unverified, which the default says too.
          defaultValue: 'unverified',
          index: true,
          options: VERDICTS.map((value) => ({ label: value, value })),
          access: verdictAccess,
          admin: { width: '50%' },
        },
        {
          name: 'date',
          type: 'date',
          access: verdictAccess,
          admin: {
            width: '50%',
            date: { pickerAppearance: 'dayOnly', displayFormat: 'd MMM yyyy' },
            description: 'Set when the verdict changes.',
          },
        },
      ],
    },
    {
      name: 'rationale',
      type: 'textarea',
      localized: true,
      access: verdictAccess,
      admin: { description: 'How the claim was checked. Shown on the claim page.' },
    },
    {
      name: 'reportUrl',
      label: 'Report',
      type: 'text',
      access: verdictAccess,
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'string' && /^https:\/\/\S+$/.test(value))
          ? true
          : 'Give a full web address, starting with https://.',
      admin: { description: 'A published fact-check report, if there is one.' },
    },
    {
      name: 'verifiedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true, description: 'Set when the verdict changes.' },
      // Internal: only staff read it, and only the system writes it (section 13).
      access: { read: signedIn, create: () => false, update: () => false },
    },
  ],
}

/**
 * A reviewer may set a claim's verdict but not edit the claim (section 13.2).
 * Their save keeps every other field as it was.
 */
const reviewersOnlyVerify: CollectionBeforeChangeHook = ({ data, originalDoc, req, operation }) => {
  if (operation !== 'update' || !req.user || !originalDoc) return data
  if (userCan(req.user, 'editRecords') || !userCan(req.user, 'setVerdict')) return data
  // Everything but the verification comes from the stored record. A key the
  // record does not have, such as a trash date, is dropped.
  const kept: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (key === 'verification') kept[key] = data[key]
    else if (key in originalDoc) kept[key] = originalDoc[key]
  }
  return kept
}

/**
 * Every field but the verification is editable only by those who edit
 * records. A reviewer sees the rest of the claim read-only, and can set only
 * its verdict (section 13.2).
 */
function editorsOnly(fields: Field[]): Field[] {
  return fields.map((field): Field => {
    if (field.type === 'ui' || ('name' in field && field.name === 'verification')) return field
    if ('name' in field) {
      const own = field as Field & { access?: Record<string, unknown> }
      return { ...own, access: { update: can.editRecords, ...own.access } } as Field
    }
    if ('fields' in field) return { ...field, fields: editorsOnly(field.fields) } as Field
    if (field.type === 'tabs') {
      return {
        ...field,
        tabs: field.tabs.map((tab) => ({ ...tab, fields: editorsOnly(tab.fields) })),
      } as Field
    }
    return field
  })
}

/**
 * Every save of a claim takes its rating fields from its updates and reviews
 * (section 7.6). With drafts, Payload builds a save from the latest version,
 * which does not have what the updates wrote, so it would otherwise be lost.
 * A new claim keeps the starting rating checkClaim gave it.
 */
const keepRatingInStep: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const id = idOf(originalDoc?.id)
  if (!id) return data
  return { ...data, ...(await ratingFromUpdates(req, id)) }
}

/** A changed verdict records when, and who set it. */
const stampVerification: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const stored = asRecordOf(asRecordOf(originalDoc).verification)
  const incoming = asRecordOf(data.verification)
  if (!('verdict' in incoming)) return data
  // A cleared verdict is unverified, so the claim stays in the queue.
  const verdict = verdictOf(data)
  const before = verdictOf(asRecordOf(originalDoc))
  if (verdict === before) return { ...data, verification: { ...incoming, verdict } }
  // Payload fills a field the save left out from the stored record before
  // this runs, so a date equal to the stored one was not chosen by anyone:
  // the new verdict gets today's date. A different date was.
  const sameInstant = (a: unknown, b: unknown) =>
    Boolean(a) && Boolean(b) && new Date(String(a)).getTime() === new Date(String(b)).getTime()
  const chosen = incoming.date && !sameInstant(incoming.date, stored.date) ? incoming.date : null
  return {
    ...data,
    verification: {
      ...incoming,
      verdict,
      date: chosen ?? new Date().toISOString(),
      verifiedBy: req.user ? req.user.id : null,
    },
  }
}

/** A claim found false or misleading is never deleted: it stays on the record (section 5.1). */
const neverDeleteFoundFalse: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: id } },
    select: { verification: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the verdict, whoever deletes the claim.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const [claim] = docs
  if (claim && FOUND_FALSE.includes(verdictOf(claim))) {
    throw new APIError(
      'A claim found false or misleading is never deleted. Archive it instead.',
      400,
    )
  }
}

/** Nor is it moved to the trash. */
const keepFoundFalse: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const trashing = Boolean(data.deletedAt) && !originalDoc?.deletedAt
  if (trashing && FOUND_FALSE.includes(verdictOf({ ...asRecordOf(originalDoc), ...data }))) {
    throw new APIError(
      'A claim found false or misleading is never deleted. Archive it instead.',
      400,
    )
  }
  return data
}

/**
 * The checks a claim must pass to be published (section 8.1): verified, a
 * topic, a source, and a deadline if its rating needs one. Evidence arrives
 * with claim updates (#651), and counts as a source once its field exists.
 */
const claimChecks: PublishingCheck = async (claim, { payload, req }) => {
  const problems: string[] = []
  const verdict = verdictOf(claim)
  if (verdict === 'false' || verdict === 'misleading') {
    problems.push(`It was found ${verdict}. Such claims are never published.`)
  } else if (verdict !== 'verified') {
    problems.push('It is not verified yet.')
  }
  if (!idOf(claim.topic)) problems.push('It needs a topic.')
  const hasSource =
    (typeof claim.sourceUrl === 'string' && claim.sourceUrl.trim() !== '') ||
    Boolean(idOf(claim.source)) ||
    (await hasEvidence(payload, req, claim))
  if (!hasSource) problems.push('It needs a source: a link to where it was said, or a document.')
  if (!claim.deadline && (await ratingNeedsDeadline(payload, req, claim))) {
    problems.push('Its rating needs a deadline.')
  }
  return problems
}

/** Whether one of the claim's updates that count has evidence (section 7.6). */
async function hasEvidence(
  payload: Payload,
  req: Partial<PayloadRequest>,
  claim: Record<string, unknown>,
): Promise<boolean> {
  const id = idOf(claim.id)
  if (!id) return false
  const { docs } = await payload.find({
    collection: 'claim-updates',
    where: {
      and: [
        { claim: { equals: id } },
        { recordStatus: { equals: 'ready' } },
        { evidence: { exists: true } },
      ],
    },
    select: { _status: true },
    // Every language's status: a draft's evidence is not public, so it is no source.
    locale: 'all',
    depth: 0,
    pagination: false,
    // Reads the claim's evidence, whoever saved it.
    overrideAccess: true,
    req,
  })
  return docs.some((doc) => publishedAnywhere(doc._status))
}

/** Whether the claim's current rating, on its type's scale, needs a deadline. */
async function ratingNeedsDeadline(
  payload: Payload,
  req: Partial<PayloadRequest>,
  claim: Record<string, unknown>,
): Promise<boolean> {
  const typeId = idOf(claim.type)
  if (!typeId || typeof claim.currentRating !== 'string') return false
  // Reads the claim's type and scale, to check its rating, whoever saved it.
  const type = await payload.find({
    collection: 'claim-types',
    where: { id: { equals: typeId } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
    req,
  })
  const scale: unknown = type.docs[0]?.ratingScale
  const ratings: unknown =
    scale && typeof scale === 'object' ? Reflect.get(scale, 'ratings') : undefined
  if (!Array.isArray(ratings)) return false
  const rating: unknown = ratings.find(
    (r: unknown) => r && typeof r === 'object' && Reflect.get(r, 'slug') === claim.currentRating,
  )
  return Boolean(rating && typeof rating === 'object' && Reflect.get(rating, 'needsDeadline'))
}

/** A change to a claim refreshes its country's claim pages, and the topic pages (section 17). */
const refreshClaims = async (req: PayloadRequest, ...countries: unknown[]) => {
  const codes = new Set<string>()
  for (const country of countries) {
    const code = await countryCode(req, country)
    if (code) codes.add(code)
  }
  await refreshTags(['topics', ...[...codes].map((code) => `claims:${code}`)], req)
}

// A claim never changes country, so its own is the only one to refresh.
const refreshOnClaimChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  await refreshClaims(req, doc.country)
  return doc
}

const refreshOnClaimDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await refreshClaims(req, doc.country)
  return doc
}

/** Claims an actor made or shares, and their figures, live on the actor and claim pages. */
export const Claims: CollectionConfig = withPublishing(
  {
    slug: 'claims',
    admin: {
      group: ADMIN_GROUPS.claims,
      useAsTitle: 'title',
      defaultColumns: ['title', 'actor', 'currentRating', 'topic', 'recordStatus'],
    },
    // Saved views, such as "Awaiting verification" (section 5.1).
    enableQueryPresets: true,
    endpoints: [confirmRating],
    access: {
      read: readClaims,
      create: can.createClaims,
      // Reviewers update a claim only to set its verdict (section 5.1).
      update: ({ req }) => can.editRecords({ req }) || can.setVerdict({ req }),
      delete: can.deleteRecords,
    },
    indexes: [{ fields: ['country', 'slug'], unique: true }],
    hooks: {
      beforeValidate: [slugFromTitle],
      beforeChange: [
        reviewersOnlyVerify,
        checkClaim,
        keepFormerSlug,
        stampVerification,
        keepFoundFalse,
        keepRatingInStep,
      ],
      beforeDelete: [neverDeleteFoundFalse, deleteClaimHistory],
      afterChange: [refreshOnClaimChange],
      afterDelete: [refreshOnClaimDelete],
    },
    fields: editorsOnly([
      {
        name: 'title',
        type: 'text',
        localized: true,
        required: true,
        admin: { description: 'The headline, such as "Build 200,000 homes a year".' },
      },
      {
        name: 'statement',
        type: 'textarea',
        admin: {
          description: 'The exact words, in the language they were said. Never translated.',
        },
      },
      { name: 'summary', type: 'textarea', localized: true },
      {
        type: 'row',
        fields: [
          {
            name: 'actor',
            type: 'relationship',
            relationTo: 'actors',
            required: true,
            index: true,
          },
          { name: 'coActors', type: 'relationship', relationTo: 'actors', hasMany: true },
        ],
      },
      {
        type: 'row',
        fields: [
          {
            name: 'term',
            type: 'relationship',
            relationTo: 'terms',
            filterOptions: ({ siblingData }) => {
              const actor = idOf((siblingData as { actor?: unknown }).actor)
              return actor ? { actor: { equals: actor } } : true
            },
          },
          {
            name: 'area',
            type: 'relationship',
            relationTo: 'areas',
            admin: { description: 'Only when narrower than the actor’s seat.' },
          },
        ],
      },
      {
        type: 'row',
        fields: [
          { name: 'topic', type: 'relationship', relationTo: 'topics', index: true },
          { name: 'type', type: 'relationship', relationTo: 'claim-types', index: true },
        ],
      },
      { name: 'tags', type: 'text', hasMany: true },
      {
        type: 'row',
        fields: [
          {
            name: 'saidAt',
            type: 'text',
            admin: { description: 'Where, such as a rally in Kisumu.' },
          },
          partialDate('saidOn', 'When it was said.'),
        ],
      },
      {
        type: 'row',
        fields: [
          partialDate('deadline', 'When it is due.'),
          {
            name: 'deadlineText',
            type: 'text',
            localized: true,
            admin: { description: 'The deadline in words, such as "End of term".' },
          },
        ],
      },
      {
        name: 'source',
        label: 'Source document',
        type: 'relationship',
        relationTo: 'documents',
        index: true,
        admin: { description: 'The manifesto, speech or report the claim comes from.' },
      },
      {
        type: 'row',
        fields: [
          {
            name: 'sourceUrl',
            type: 'text',
            admin: { description: 'Shown as a link. The server never opens it.' },
            validate: (value: unknown) =>
              value === null ||
              value === undefined ||
              value === '' ||
              (typeof value === 'string' && /^https?:\/\/\S+$/.test(value))
                ? true
                : 'Give a full web address, starting with https://.',
          },
          {
            name: 'sourceLocator',
            type: 'text',
            admin: { description: 'Where in the source, such as page 12.' },
          },
        ],
      },
      verificationField,
      {
        type: 'row',
        fields: [
          { name: 'image', type: 'upload', relationTo: 'media' },
          { name: 'imageCredit', type: 'text' },
        ],
      },
      {
        name: 'slug',
        type: 'text',
        index: true,
        admin: {
          position: 'sidebar',
          description:
            'Made from the title when you save. Used in addresses, such as /en/ke/p/kibra-housing.',
        },
      },
      {
        ...countryField,
        required: false,
        admin: { position: 'sidebar', readOnly: true, description: 'The actor’s country.' },
        // Set from the actor.
        access: { create: () => false, update: () => false },
      },
      formerSlugsField,
      {
        name: 'currentRating',
        label: 'Current rating',
        type: 'text',
        index: true,
        hooks: { afterRead: [fromLiveClaim('currentRating')] },
        admin: {
          position: 'sidebar',
          readOnly: true,
          description:
            'From the latest published update. A new claim starts on its scale’s starting rating.',
        },
        access: { create: () => false, update: () => false },
      },
      {
        name: 'ratedOn',
        label: 'Rated on',
        type: 'date',
        hooks: { afterRead: [fromLiveClaim('ratedOn')] },
        admin: { position: 'sidebar', readOnly: true },
        access: { create: () => false, update: () => false },
      },
      {
        name: 'lastReviewedAt',
        label: 'Last reviewed',
        type: 'date',
        hooks: { afterRead: [fromLiveClaim('lastReviewedAt')] },
        admin: { position: 'sidebar', readOnly: true },
        access: { create: () => false, update: () => false },
      },
      {
        name: 'updateCount',
        label: 'Updates',
        type: 'number',
        defaultValue: 0,
        hooks: { afterRead: [fromLiveClaim('updateCount')] },
        admin: { position: 'sidebar', readOnly: true },
        access: { create: () => false, update: () => false },
      },
      {
        name: 'confirmRating',
        type: 'ui',
        admin: {
          position: 'sidebar',
          components: { Field: '@promisetracker/plugin-core/client#ConfirmRating' },
        },
      },
      {
        type: 'collapsible',
        label: 'How it was found',
        admin: { position: 'sidebar', initCollapsed: true },
        fields: [
          {
            name: 'extraction',
            type: 'select',
            access: { read: signedIn },
            defaultValue: 'manual',
            options: EXTRACTIONS.map((value) => ({ label: value, value })),
          },
          {
            name: 'confidence',
            type: 'number',
            min: 0,
            max: 1,
            // How a claim was found is for staff, not the public (D46).
            access: { read: signedIn },
          },
          {
            name: 'enteredBy',
            type: 'relationship',
            relationTo: 'users',
            admin: { readOnly: true },
            access: { read: signedIn, create: () => false, update: () => false },
          },
        ],
      },
    ]),
  },
  ['title'],
  {
    parents: [
      { field: 'country', collection: 'countries' },
      { field: 'actor', collection: 'actors' },
      // Holding a document hides the claims drawn from it (section 8.1).
      { field: 'source', collection: 'documents', optional: true },
    ],
    checks: claimChecks,
  },
)

/** A topic has at most one level above it (section 7.7). */
const checkTopic: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const slug = valueIn(data, originalDoc, 'slug')
  if (typeof slug !== 'string' || !slug) {
    // A name in a script with no Latin letters makes no slug.
    throw new APIError(
      'A slug cannot be made from this name. Give one in the sidebar, such as health.',
      400,
    )
  }
  if (!SLUG_PATTERN.test(slug)) {
    throw new APIError(
      'Use lower-case letters, digits and single hyphens in the slug, such as health.',
      400,
    )
  }
  const parent = await load(req, 'topics', valueIn(data, originalDoc, 'parent'))
  if (parent?.parent) {
    throw new APIError('Topics nest one level only. Choose a topic with no parent.', 400)
  }
  if (parent && originalDoc?.id) {
    const { totalDocs } = await req.payload.count({
      collection: 'topics',
      where: { parent: { equals: originalDoc.id } },
      // Counts the topics under this one, whoever saves it.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    if (totalDocs > 0) {
      throw new APIError('This topic has topics under it, so it cannot go under another.', 400)
    }
  }
  return data
}

/** A topic that claims or other topics use stays, so nothing points at a deleted topic. */
const keepTopicInUse: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const count = async (collection: 'claims' | 'topics', field: 'topic' | 'parent') =>
    (
      await req.payload.count({
        collection,
        where: { [field]: { equals: id } },
        // Counts what points at the topic, whoever deletes it.
        overrideAccess: true,
        req: { ...req } as PayloadRequest,
      })
    ).totalDocs
  const claims = await count('claims', 'topic')
  if (claims > 0) {
    throw new APIError(`${claims} claim(s) use this topic. Move them to another topic first.`, 400)
  }
  const children = await count('topics', 'parent')
  if (children > 0) {
    throw new APIError(`${children} topic(s) sit under this one. Move or delete them first.`, 400)
  }
}

const refreshTopics: CollectionAfterChangeHook = async ({ doc, req }) => {
  await refreshTags(['topics'], req)
  return doc
}

const refreshTopicsOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await refreshTags(['topics'], req)
  return doc
}

/** Subjects shared by every country, such as Health, one level deep (section 7.7). */
export const Topics: CollectionConfig = withTrash({
  slug: 'topics',
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'parent'],
  },
  // Payload keeps the parent links and refuses a parent chain that loops.
  hierarchy: { parentFieldName: 'parent', slugField: 'slug' },
  access: {
    read: readTopics,
    create: can.editEditorial,
    update: can.editEditorial,
    delete: can.deleteRecords,
  },
  hooks: {
    beforeValidate: [slugFromName],
    beforeChange: [checkTopic],
    beforeDelete: [keepTopicInUse],
    afterChange: [refreshTopics],
    afterDelete: [refreshTopicsOnDelete],
  },
  fields: [
    { name: 'name', type: 'text', localized: true, required: true },
    { name: 'description', type: 'textarea', localized: true },
    {
      type: 'row',
      fields: [
        {
          name: 'parent',
          type: 'relationship',
          relationTo: 'topics',
          hasMany: false,
          index: true,
          admin: { description: 'The broader topic it sits under, if any.' },
        },
        {
          name: 'colour',
          type: 'text',
          admin: { placeholder: '#17694e' },
          validate: (value: unknown) =>
            value === null || value === undefined || value === '' || isHexColour(value)
              ? true
              : 'Give a colour as # and six hex digits, such as #17694e.',
        },
      ],
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Made from the name when you save. Used in addresses, such as /en/topics/health.',
      },
    },
  ],
})

// Claims carry ratings by slug, on their type's scale. This tells the rating
// scales which claims carry a rating, so one in use is not deleted.
setRatingUsage(async ({ req, scale, rating }) => {
  const types = await req.payload.find({
    collection: 'claim-types',
    where: { ratingScale: { equals: scale } },
    depth: 0,
    pagination: false,
    // Finds the claim types on a scale, whoever edits the scale.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  if (types.docs.length === 0) return []
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: {
      and: [{ type: { in: types.docs.map((t) => t.id) } }, { currentRating: { equals: rating } }],
    },
    depth: 0,
    // Every claim, so the count an editor sees is the whole count.
    pagination: false,
    select: { title: true, slug: true },
    // Lists the claims carrying a rating, for the editor of the scale.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return docs.map((doc) => ({ id: String(doc.id), title: String(doc.title ?? doc.slug ?? doc.id) }))
})

// A claim type keeps its scale while claims of that type exist.
setClaimTypeUsage(async ({ req, type }) => {
  const { totalDocs } = await req.payload.count({
    collection: 'claims',
    where: { type: { equals: type } },
    // Counts the claims of a type, for whoever edits the type.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return totalDocs
})
