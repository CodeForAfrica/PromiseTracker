import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
  Endpoint,
  Field,
  FieldHook,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can, signedIn, userCan } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { afterCommit } from './afterCommit'
import { refreshTags } from './cache'
import { countryCode, countryField, idOf } from './places'
import { recomputeAndCascade, withPublishing, withTrash } from './publishing'

/**
 * The tracker (sections 7.6 and 8.4): dated updates that set a claim's
 * rating, the evidence behind them, and the reviews that keep a claim's
 * last-reviewed date honest.
 */

export const UPDATE_KINDS = ['first-rating', 'change', 'correction'] as const
export type UpdateKind = (typeof UPDATE_KINDS)[number]

export const EVIDENCE_KINDS = ['document', 'dataset', 'social-post', 'article'] as const

export const REVIEW_OUTCOMES = ['confirmed', 'changed', 'updated'] as const

/** `2027`, `2027-08` or `2027-08-09` (D55). */
const PARTIAL_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/

/** The first day a partial date covers, as a timestamp: `2027-08` is 1 August 2027. */
export function partialDateStart(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = PARTIAL_DATE.exec(value)
  if (!match) return null
  const [, year, month = '01', day = '01'] = match
  return `${year}-${month}-${day}T00:00:00.000Z`
}

const partialDateField = (name: string, description: string, required = false): Field => ({
  name,
  type: 'text',
  index: true,
  required,
  admin: { description, placeholder: '2027, 2027-08 or 2027-08-09' },
  validate: (value: unknown) =>
    value === null || value === undefined || value === ''
      ? required
        ? 'Give the date, even just the year.'
        : true
      : PARTIAL_DATE.test(String(value))
        ? true
        : 'Give a year, a year and month, or a full date: 2027, 2027-08 or 2027-08-09.',
})

const httpsOnly = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'string' && /^https?:\/\/\S+$/.test(value))
    ? true
    : 'Give a full web address, starting with https://.'

/** A piece of evidence: a document, dataset, social post or article (section 7.6). */
export const Evidence: CollectionConfig = withTrash({
  slug: 'evidence',
  labels: { singular: 'Evidence', plural: 'Evidence' },
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'publisher', 'date'],
  },
  access: {
    // The public API shows the evidence of published updates only. Anything
    // else may belong to an update still on hold.
    read: signedIn,
    create: can.editRecords,
    update: can.editRecords,
    delete: can.deleteRecords,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'document',
          options: EVIDENCE_KINDS.map((value) => ({ label: value, value })),
        },
        { name: 'publisher', type: 'text' },
        partialDateField('date', 'When it was published.'),
      ],
    },
    {
      name: 'link',
      type: 'text',
      index: true,
      validate: httpsOnly,
      admin: { description: 'Shown as a link. The server never opens it.' },
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Instead of a link, such as a photo of a site visit.' },
    },
    {
      name: 'finding',
      type: 'textarea',
      localized: true,
      admin: { description: 'One line: what the evidence shows.' },
    },
    { name: 'thumbnail', type: 'upload', relationTo: 'media' },
  ],
})

type Rated = { slug: string; retired: boolean; isStarting: boolean }

/** The ratings on a claim's type's scale. */
async function scaleOfClaim(req: PayloadRequest, claim: object): Promise<Rated[]> {
  const typeId = idOf((claim as { type?: unknown }).type)
  if (!typeId) return []
  const { docs } = await req.payload.find({
    collection: 'claim-types',
    where: { id: { equals: typeId } },
    depth: 1,
    limit: 1,
    // Reads the claim's scale, to check an update's rating, whoever saves it.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const scale: unknown = docs[0]?.ratingScale
  const ratings: unknown = scale && typeof scale === 'object' ? Reflect.get(scale, 'ratings') : null
  return Array.isArray(ratings)
    ? ratings.flatMap((r: unknown) => {
        const slug = r && typeof r === 'object' ? Reflect.get(r, 'slug') : null
        return typeof slug === 'string'
          ? [
              {
                slug,
                retired: Boolean(Reflect.get(r as object, 'retired')),
                isStarting: Boolean(Reflect.get(r as object, 'isStarting')),
              },
            ]
          : []
      })
    : []
}

/** Updates that count: ready and not in the trash. A held update changes nothing. */
const counting = (claim: string, except?: string): Where => ({
  and: [
    { claim: { equals: claim } },
    { recordStatus: { equals: 'ready' } },
    ...(except ? [{ id: { not_equals: except } }] : []),
  ],
})

/** A claim's updates that count, newest first: by date, then by when they were recorded. */
async function countingUpdates(req: PayloadRequest, claim: string, except?: string) {
  const { docs } = await req.payload.find({
    collection: 'claim-updates',
    where: counting(claim, except),
    sort: ['-date', '-createdAt'],
    depth: 0,
    pagination: false,
    // Reads the claim's updates to set its rating, whoever saves.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return docs
}

/** The rating fields a claim takes from its updates and reviews (section 7.6). */
export type ClaimRating = {
  currentRating?: string
  ratedOn: string | null
  updateCount: number
  lastReviewedAt: string | null
}

/**
 * Works out a claim's rating from its updates: the latest by date sets the
 * rating and the rated date. Without updates the claim keeps the rating it
 * started on. The last-reviewed date is the latest rating review.
 */
export async function ratingFromUpdates(req: PayloadRequest, claim: string): Promise<ClaimRating> {
  const updates = await countingUpdates(req, claim)
  const [latest] = updates
  const { docs: reviews } = await req.payload.find({
    collection: 'rating-reviews',
    where: { claim: { equals: claim } },
    sort: '-date',
    limit: 1,
    depth: 0,
    // Reads the latest review, whoever saves.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return {
    ...(latest && typeof latest.rating === 'string' ? { currentRating: latest.rating } : {}),
    ratedOn: latest ? partialDateStart(latest.date) : null,
    updateCount: updates.length,
    lastReviewedAt: (reviews[0]?.date as string | undefined) ?? null,
  }
}

/** The rating fields of the live claims read in one request, by id. */
const liveRatings = new WeakMap<object, Map<string, Promise<Record<string, unknown>>>>()

/**
 * The admin's edit view shows a claim's latest version, which never holds
 * its rating fields: the system writes those to the live record. So, for a
 * signed-in user's single read, each field reads the live record, once per
 * request. Lists and the public API read the live record already.
 */
export const fromLiveClaim =
  (name: 'currentRating' | 'ratedOn' | 'lastReviewedAt' | 'updateCount'): FieldHook =>
  async ({ value, siblingData, req, findMany }) => {
    const id = idOf((siblingData as { id?: unknown } | undefined)?.id)
    if (!req.user || !id || findMany) return value
    const reads = liveRatings.get(req) ?? new Map<string, Promise<Record<string, unknown>>>()
    liveRatings.set(req, reads)
    let read = reads.get(id)
    if (!read) {
      read = req.payload
        .find({
          collection: 'claims',
          where: { id: { equals: id } },
          select: { currentRating: true, ratedOn: true, lastReviewedAt: true, updateCount: true },
          depth: 0,
          limit: 1,
          trash: true,
          // Reads the live claim's rating for a signed-in user's admin view.
          overrideAccess: true,
          req: { ...req } as PayloadRequest,
        })
        .then(({ docs }) => ({ ...docs[0] }))
      reads.set(id, read)
    }
    return (await read)[name] ?? value
  }

/**
 * Sets a claim's rating fields from its updates, then works out where the
 * claim is published again, since a rating may need a deadline, and
 * refreshes its pages.
 */
async function syncClaim(req: PayloadRequest, claim: string): Promise<void> {
  const rating = await ratingFromUpdates(req, claim)
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: claim } },
    select: { country: true, type: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the claim's type and country, to rate it and refresh its pages.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const [stored] = docs
  // With no update left, the claim goes back to its scale's starting rating.
  if (!rating.currentRating && stored) {
    const starting = (await scaleOfClaim(req, stored)).find((r) => r.isStarting && !r.retired)
    if (starting) rating.currentRating = starting.slug
  }
  // Written straight to the claim: the fields follow from its updates, so
  // this is no edit of the claim's. Its own saves work them out the same way.
  await req.payload.db.updateOne({
    collection: 'claims',
    id: claim,
    data: rating,
    req,
    returning: false,
  })
  liveRatings.get(req)?.delete(claim)
  await recomputeAndCascade(req, 'claims', claim)
  const code = await countryCode(req, stored?.country)
  if (code)
    await refreshTags([`claims:${code}`, `actors:${code}`, `country:${code}`, 'topics'], req)
  await queueRefreshCounts(req, code)
}

/** Records a rating review: who looked at a claim's rating, when, and what they found. */
async function recordReview(
  req: PayloadRequest,
  claim: string,
  outcome: (typeof REVIEW_OUTCOMES)[number],
  rating: string | null,
): Promise<void> {
  await req.payload.create({
    collection: 'rating-reviews',
    data: {
      claim,
      outcome,
      rating,
      date: new Date().toISOString(),
      reviewer: req.user ? req.user.id : null,
    },
    // The system records reviews. Who reviewed was checked by the save or the action.
    overrideAccess: true,
    req,
  })
}

/**
 * Checks an update before it is saved (section 7.6): its rating is on the
 * claim's scale, and a change of rating has evidence. It takes its country
 * from its claim, and its kind from whether it is the claim's first.
 */
const checkUpdate: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const claimId = idOf(data.claim ?? originalDoc?.claim)
  if (!claimId) throw new APIError('Choose the claim this update is about.', 400)
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: claimId } },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the claim an update is about, to check the rating.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const [claim] = docs
  if (!claim) throw new APIError('Choose the claim this update is about.', 400)
  const ratings = await scaleOfClaim(req, claim)
  const rating = (data.rating ?? originalDoc?.rating) as unknown
  const known = ratings.find((r) => r.slug === rating)
  if (!known) {
    throw new APIError(
      `Choose a rating on the claim's scale: ${ratings
        .filter((r) => !r.retired)
        .map((r) => r.slug)
        .join(', ')}.`,
      400,
    )
  }
  if (known.retired && rating !== originalDoc?.rating) {
    throw new APIError(`"${String(rating)}" is retired. Choose a rating in use.`, 400)
  }
  // The rating before this update: the latest other update on or before its date.
  const date = String(data.date ?? originalDoc?.date ?? '')
  const others = await countingUpdates(req, claimId, idOf(originalDoc?.id) ?? undefined)
  const before = others.find((u) => String(u.date) <= date)
  const previous = before?.rating ?? ratings.find((r) => r.isStarting)?.slug ?? null
  const evidence = (data.evidence ?? originalDoc?.evidence) as unknown
  const hasEvidence = Array.isArray(evidence) && evidence.length > 0
  if (rating !== previous && !hasEvidence) {
    throw new APIError(
      'A change of rating needs at least one piece of evidence. Add it under Evidence.',
      400,
    )
  }
  const kind = data.kind ?? originalDoc?.kind ?? (others.length === 0 ? 'first-rating' : 'change')
  return { ...data, kind, country: idOf(claim.country) }
}

const syncOnChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation }) => {
  const claim = idOf(doc.claim)
  if (!claim) return doc
  const nowCounts = doc.recordStatus === 'ready' && !doc.deletedAt
  const counted = previousDoc?.recordStatus === 'ready' && !previousDoc?.deletedAt
  // A review is recorded when an update starts to count, or its rating changes while it does.
  if (nowCounts && (operation === 'create' || !counted || previousDoc?.rating !== doc.rating)) {
    const latest = (await countingUpdates(req, claim))[0]
    const outcome =
      latest?.id === doc.id && previousDoc?.rating !== doc.rating ? 'changed' : 'updated'
    await recordReview(req, claim, outcome, typeof doc.rating === 'string' ? doc.rating : null)
  }
  const before = idOf(previousDoc?.claim)
  await syncClaim(req, claim)
  if (before && before !== claim) await syncClaim(req, before)
  return doc
}

const syncOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const claim = idOf(doc.claim)
  // A claim being deleted takes its updates with it, and has nothing to sync.
  if (claim && req.context.deletingClaim !== claim) await syncClaim(req, claim)
  return doc
}

/**
 * A claim deleted for good takes its updates and rating reviews with it:
 * they belong to it, and cannot point at nothing. Moving a claim to the
 * trash keeps them, so restoring it brings its history back.
 */
export const deleteClaimHistory: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const claim = String(id)
  req.context.deletingClaim = claim
  // Whoever may delete the claim may delete what belongs to it.
  await req.payload.delete({
    collection: 'claim-updates',
    where: { claim: { equals: claim } },
    trash: true,
    overrideAccess: true,
    req,
  })
  await req.payload.delete({
    collection: 'rating-reviews',
    where: { claim: { equals: claim } },
    overrideAccess: true,
    req,
  })
}

/** Updates are public with their claim, once ready and published in the language. */
const readUpdates = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || {
    and: [{ recordStatus: { equals: 'ready' } }, { 'claim.recordStatus': { equals: 'ready' } }],
  }

/** A dated entry in a claim's history: the new rating, what happened, and the evidence (section 7.6). */
export const ClaimUpdates: CollectionConfig = withPublishing(
  {
    slug: 'claim-updates',
    labels: { singular: 'Claim update', plural: 'Claim updates' },
    admin: {
      group: ADMIN_GROUPS.claims,
      useAsTitle: 'title',
      defaultColumns: ['title', 'claim', 'date', 'rating', 'kind', 'recordStatus'],
    },
    defaultSort: '-date',
    access: {
      read: readUpdates,
      // Rating a claim, which is what an update does (section 13.2).
      create: can.rateClaims,
      update: can.rateClaims,
      delete: can.deleteRecords,
    },
    hooks: {
      beforeChange: [checkUpdate],
      afterChange: [syncOnChange],
      afterDelete: [syncOnDelete],
    },
    fields: [
      { name: 'claim', type: 'relationship', relationTo: 'claims', required: true, index: true },
      {
        type: 'row',
        fields: [
          partialDateField(
            'date',
            'When it happened, which may be long before it was recorded.',
            true,
          ),
          {
            name: 'rating',
            type: 'text',
            required: true,
            index: true,
            admin: { description: 'The rating as of that date, from the claim’s scale.' },
          },
          {
            name: 'kind',
            type: 'select',
            options: UPDATE_KINDS.map((value) => ({ label: value, value })),
            admin: {
              description: 'A correction fixes our own earlier mistake. Set for you if empty.',
            },
          },
        ],
      },
      { name: 'title', type: 'text', localized: true, required: true },
      {
        name: 'narrative',
        type: 'textarea',
        localized: true,
        admin: { description: 'What happened, and how we know.' },
      },
      {
        name: 'evidence',
        type: 'relationship',
        relationTo: 'evidence',
        hasMany: true,
        admin: { description: 'At least one piece when the rating changes.' },
      },
      {
        name: 'attribution',
        type: 'text',
        admin: { description: 'Credit for a citizen who sent this in, with their consent.' },
      },
      {
        ...countryField,
        required: false,
        admin: { position: 'sidebar', readOnly: true, description: 'The claim’s country.' },
        // Set from the claim.
        access: { create: () => false, update: () => false },
      },
    ],
  },
  ['title'],
  { parents: [{ field: 'claim', collection: 'claims' }] },
)

/** Who looked at a claim's rating, when, and what they found (section 8.4). Internal. */
export const RatingReviews: CollectionConfig = {
  slug: 'rating-reviews',
  labels: { singular: 'Rating review', plural: 'Rating reviews' },
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'outcome',
    defaultColumns: ['claim', 'outcome', 'rating', 'reviewer', 'date'],
  },
  defaultSort: '-date',
  // A review is never edited, so it has no history of its own.
  versions: false,
  access: {
    read: signedIn,
    // Only the system records reviews: by an update, or by "Confirm rating".
    create: () => false,
    update: () => false,
    delete: can.manageUsers,
  },
  fields: [
    { name: 'claim', type: 'relationship', relationTo: 'claims', required: true, index: true },
    {
      name: 'outcome',
      type: 'select',
      required: true,
      options: REVIEW_OUTCOMES.map((value) => ({ label: value, value })),
    },
    { name: 'rating', type: 'text' },
    { name: 'reviewer', type: 'relationship', relationTo: 'users' },
    { name: 'date', type: 'date', required: true, index: true },
  ],
}

/**
 * "Confirm rating" (section 8.4): records a review that finds nothing new,
 * moving the last-reviewed date without a public update.
 */
export const confirmRating: Endpoint = {
  path: '/:id/confirm-rating',
  method: 'post',
  handler: async (req) => {
    if (!userCan(req.user, 'rateClaims')) {
      return Response.json({ error: 'You cannot confirm ratings.' }, { status: 403 })
    }
    const id = typeof req.routeParams?.id === 'string' ? req.routeParams.id : ''
    const { docs } = await req.payload.find({
      collection: 'claims',
      where: { id: { equals: id } },
      select: { currentRating: true },
      depth: 0,
      limit: 1,
      // The user's right to confirm was checked above.
      overrideAccess: true,
      req,
    })
    const [claim] = docs
    if (!claim) return Response.json({ error: 'There is no such claim.' }, { status: 404 })
    await recordReview(
      req,
      id,
      'confirmed',
      typeof claim.currentRating === 'string' ? claim.currentRating : null,
    )
    await syncClaim(req, id)
    const rating = await ratingFromUpdates(req, id)
    return Response.json({ lastReviewedAt: rating.lastReviewedAt })
  },
}

/** Queues the job that refreshes the pages showing a country's figures. */
async function queueRefreshCounts(req: PayloadRequest, code: string | null): Promise<void> {
  if (!code) return
  await afterCommit(req, async () => {
    // Who changed the rating was checked by the save, so the job is queued as the system.
    await req.payload.jobs.queue({
      task: 'refreshCounts',
      input: { country: code },
      overrideAccess: true,
    })
  })
}

/**
 * Rating counts by actor, area, topic and country (sections 9.8 and 16.2).
 * They are worked out from the claims on each request (D57), and the pages
 * that show them are cached, so this job refreshes those pages. It runs after
 * a rating changes, and after a cascade.
 */
export const refreshCountsTask = {
  slug: 'refreshCounts',
  inputSchema: [{ name: 'country', type: 'text' as const, required: true }],
  retries: 2,
  handler: async ({ input, req }: { input: { country: string }; req: PayloadRequest }) => {
    const code = input.country
    await refreshTags([`claims:${code}`, `actors:${code}`, `country:${code}`, 'topics'], req)
    return { output: {} }
  },
}
