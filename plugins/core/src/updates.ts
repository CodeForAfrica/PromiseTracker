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
import { APIError, commitTransaction, initTransaction, killTransaction } from 'payload'

import { can, signedIn, userCan } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { afterCommit } from './afterCommit'
import { refreshTags } from './cache'
import { countryCode, countryField, idOf } from './places'
import { recomputeAndCascade, withPublishing, withTrash } from './publishing'
import type { RatingChoice } from './ratingChoices'
import { setRatingHistoryUsage } from './ratings'

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
  const start = `${year}-${month}-${day}T00:00:00.000Z`
  // A date that does not exist, such as 2027-02-30, comes back as another day.
  const parsed = new Date(start)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === start ? start : null
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
      : partialDateStart(value)
        ? true
        : 'Give a year, a year and month, or a full date: 2027, 2027-08 or 2027-08-09.',
})

const httpsOnly = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'string' && /^https?:\/\/\S+$/.test(value))
    ? true
    : 'Give a full web address, starting with https:// or http://.'

/**
 * Claim pages show the evidence of their updates, so a change to a piece of
 * evidence, or its removal, refreshes the pages of every country citing it.
 */
async function citingPages(
  req: PayloadRequest,
  evidence: string,
): Promise<{ claims: string[]; codes: string[] }> {
  const { docs } = await req.payload.find({
    collection: 'claim-updates',
    where: { evidence: { in: [evidence] } },
    select: { country: true, claim: true },
    depth: 0,
    pagination: false,
    trash: true,
    // Finds which countries' pages cite the evidence, whoever changed it.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const codes = new Set<string>()
  for (const doc of docs) {
    const code = await countryCode(req, doc.country)
    if (code) codes.add(code)
  }
  const claims = new Set(docs.map((doc) => idOf(doc.claim)).filter((id) => id !== null))
  return { claims: [...claims], codes: [...codes] }
}

/**
 * Evidence can be a claim's only source, so withdrawing or restoring it can
 * change where the claim is published. Its pages are refreshed too.
 */
async function refreshPages(
  req: PayloadRequest,
  { claims, codes }: { claims: readonly string[]; codes: readonly string[] },
): Promise<void> {
  for (const claim of claims) await recomputeAndCascade(req, 'claims', claim)
  for (const code of codes) await refreshTags([`claims:${code}`, `actors:${code}`], req)
}

const refreshOnEvidenceChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  await refreshPages(req, await citingPages(req, String(doc.id)))
  return doc
}

/** The pages citing evidence being deleted for good, by its id, for this request. */
const citingBeforeDelete = new WeakMap<
  object,
  Map<string, Awaited<ReturnType<typeof citingPages>>>
>()

/**
 * The database drops an update's links to evidence deleted for good, so
 * what cites it is read before the delete.
 */
const noteCitingPages: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const notes = citingBeforeDelete.get(req) ?? new Map()
  citingBeforeDelete.set(req, notes)
  notes.set(String(id), await citingPages(req, String(id)))
}

const refreshOnEvidenceDelete: CollectionAfterDeleteHook = async ({ id, doc, req }) => {
  const key = String(id ?? doc.id)
  const noted = citingBeforeDelete.get(req)?.get(key)
  citingBeforeDelete.get(req)?.delete(key)
  if (noted) await refreshPages(req, noted)
  return doc
}

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
  hooks: {
    beforeDelete: [noteCitingPages],
    afterChange: [refreshOnEvidenceChange],
    afterDelete: [refreshOnEvidenceDelete],
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

/** Whether Payload's draft status, in one language or by language, is published in any. */
export const publishedAnywhere = (status: unknown): boolean =>
  typeof status === 'string'
    ? status === 'published'
    : Boolean(status) &&
      typeof status === 'object' &&
      Object.values(status as Record<string, unknown>).includes('published')

/**
 * A claim's updates that count, newest first: by date, then by when they
 * were recorded. An update counts once it is ready and published in some
 * language. A draft never published, or a draft of changes, changes nothing.
 */
async function countingUpdates(req: PayloadRequest, claim: string, except?: string) {
  const { docs } = await req.payload.find({
    collection: 'claim-updates',
    where: counting(claim, except),
    sort: ['-date', '-createdAt'],
    // Every language's draft status, to tell a published update from a draft.
    locale: 'all',
    depth: 0,
    pagination: false,
    // Reads the claim's updates to set its rating, whoever saves.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return docs.filter((doc) => publishedAnywhere(doc._status))
}

/** What an update is on the live record: its claim, its rating, and whether it counts. */
type LiveUpdate = { claim: string | null; rating: string | null; counts: boolean }

/**
 * Reads an update as the live record holds it. A draft save leaves the live
 * record as it was, so this, not the saved draft, says what the public sees.
 */
async function liveUpdate(req: PayloadRequest, id: string): Promise<LiveUpdate | null> {
  const { docs } = await req.payload.find({
    collection: 'claim-updates',
    where: { id: { equals: id } },
    locale: 'all',
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the update's live state to set its claim's rating, whoever saves.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const [doc] = docs
  if (!doc) return null
  return {
    claim: idOf(doc.claim),
    rating: typeof doc.rating === 'string' ? doc.rating : null,
    counts: doc.recordStatus === 'ready' && !doc.deletedAt && publishedAnywhere(doc._status),
  }
}

/** Each update's live state before the save under way, by request. */
const liveBefore = new WeakMap<object, Map<string, LiveUpdate | null>>()

/** Before a save: notes what the update is on the live record. */
const rememberLive: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const id = idOf(originalDoc?.id)
  if (!id) return data
  const before = liveBefore.get(req) ?? new Map<string, LiveUpdate | null>()
  liveBefore.set(req, before)
  before.set(id, await liveUpdate(req, id))
  return data
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

/** The ratings a claim's updates give, on hold or drafts included, so a new scale must have them all. */
export async function ratingsInHistory(req: PayloadRequest, claim: string): Promise<string[]> {
  const { docs } = await req.payload.find({
    collection: 'claim-updates',
    where: { claim: { equals: claim } },
    select: { rating: true },
    depth: 0,
    pagination: false,
    // Reads the claim's updates, whoever changes its type.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return [
    ...new Set(docs.map((doc) => doc.rating).filter((r): r is string => typeof r === 'string')),
  ]
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
    const live = await read
    // A field the system cleared, such as the rated date once no update
    // counts, is null on the live record. That null is the answer, not the
    // version's older value.
    return Object.hasOwn(live, name) ? live[name] : value
  }

/**
 * Writing the claim locks its row until the save commits. Two saves of the
 * same claim's updates then take turns: the second checks its evidence and
 * works out the rating with the first one's update in it.
 */
async function lockClaim(req: PayloadRequest, claim: string, updateCount: unknown): Promise<void> {
  await req.payload.db.updateOne({
    collection: 'claims',
    id: claim,
    data: { updateCount: typeof updateCount === 'number' ? updateCount : 0 },
    req,
    returning: false,
  })
}

/**
 * Sets a claim's rating fields from its updates, then works out where the
 * claim is published again, since a rating may need a deadline, and
 * refreshes its pages. With `reviewIfChanged`, a change of the claim's
 * rating records a review, for a save that recorded none itself, such as
 * a new date that makes an update the latest.
 */
async function syncClaim(
  req: PayloadRequest,
  claim: string,
  { reviewIfChanged = false }: { reviewIfChanged?: boolean } = {},
): Promise<void> {
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: claim } },
    select: { country: true, type: true, updateCount: true, currentRating: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the claim's type and country, to rate it and refresh its pages.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const [stored] = docs
  if (!stored) return
  await lockClaim(req, claim, stored.updateCount)
  const rating = await ratingFromUpdates(req, claim)
  // With no update left, the claim goes back to its scale's starting rating.
  if (!rating.currentRating) {
    const starting = (await scaleOfClaim(req, stored)).find((r) => r.isStarting && !r.retired)
    if (starting) rating.currentRating = starting.slug
  }
  if (reviewIfChanged && rating.currentRating && rating.currentRating !== stored.currentRating) {
    rating.lastReviewedAt = await recordReview(req, claim, 'changed', rating.currentRating)
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
  const code = await countryCode(req, stored.country)
  // Refreshed now, so the change shows at once. The job does it again from
  // the worker, with retries, since a refresh that fails here is only logged.
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
): Promise<string> {
  const date = new Date().toISOString()
  await req.payload.create({
    collection: 'rating-reviews',
    data: {
      claim,
      outcome,
      rating,
      date,
      // An import runs as the system, and names who asked for it.
      reviewer: req.user ? req.user.id : importedBy(req),
    },
    // The system records reviews. Who reviewed was checked by the save or the action.
    overrideAccess: true,
    req,
  })
  return date
}

/** The pieces of evidence, by id, that are not in the trash. */
async function liveEvidence(req: PayloadRequest, evidence: unknown): Promise<number> {
  const ids = Array.isArray(evidence)
    ? evidence.map(idOf).filter((id): id is string => id !== null)
    : []
  if (ids.length === 0) return 0
  const { totalDocs } = await req.payload.count({
    collection: 'evidence',
    where: { id: { in: ids } },
    // Counts an update's evidence, whoever saves it.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return totalDocs
}

/** A field's value after this save: the saved data's, or the stored one's when the save leaves it out. */
const afterSave = (data: Record<string, unknown>, original: unknown, key: string): unknown =>
  key in data
    ? data[key]
    : original && typeof original === 'object'
      ? Reflect.get(original, key)
      : undefined

/**
 * Checks an update before it is saved (section 7.6): its rating is on the
 * claim's scale, and a change of rating has evidence. It takes its country
 * from its claim, and its kind from whether an update comes before it.
 */
const checkUpdate: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const claimId = idOf(data.claim ?? originalDoc?.claim)
  // A draft may be unfinished, and changes nothing until it is published,
  // when these checks run.
  const draft = data._status === 'draft'
  if (!claimId) {
    if (draft) return data
    throw new APIError('Choose the claim this update is about.', 400)
  }
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
  const country = idOf(claim.country)
  if (draft) return { ...data, country }
  // An update on hold or in the trash changes nothing, so it is checked when
  // it is released or restored. Holding one must work even if it would no
  // longer pass, such as after the update before it was removed.
  const counts =
    afterSave(data, originalDoc, 'recordStatus') === 'ready' &&
    !afterSave(data, originalDoc, 'deletedAt')
  if (!counts) return { ...data, country }
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
  // The rating before this update: the latest other update before it, by
  // date and then by when it was recorded (D79). A new update is recorded now.
  const date = String(data.date ?? originalDoc?.date ?? '')
  const recorded = String(originalDoc?.createdAt ?? new Date().toISOString())
  // Taken before reading the other updates, so two saves on one claim
  // cannot each miss the other's.
  await lockClaim(req, claimId, claim.updateCount)
  const others = await countingUpdates(req, claimId, idOf(originalDoc?.id) ?? undefined)
  const before = others.find(
    (u) => String(u.date) < date || (String(u.date) === date && String(u.createdAt) < recorded),
  )
  const previous = before?.rating ?? ratings.find((r) => r.isStarting)?.slug ?? null
  // Evidence in the trash is withdrawn, so it does not back a change.
  // Cleared evidence is null in the save, which must not fall back to the stored pieces.
  const evidence = afterSave(data, originalDoc, 'evidence')
  if (rating !== previous && (await liveEvidence(req, evidence)) === 0) {
    throw new APIError(
      'A change of rating needs at least one piece of evidence. Add it under Evidence.',
      400,
    )
  }
  // Editors choose a correction. Otherwise the kind follows the order by date.
  const chosen = data.kind ?? originalDoc?.kind
  const kind = chosen === 'correction' ? chosen : before ? 'change' : 'first-rating'
  return { ...data, kind, country }
}

/**
 * After a save: compares the update's live state with what it was. A
 * review is recorded when it starts to count, or its rating changes while
 * it does. A draft save leaves the live record alone, so it records nothing.
 */
const syncOnChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  const id = String(doc.id)
  const before = liveBefore.get(req)?.get(id) ?? null
  liveBefore.get(req)?.delete(id)
  const now = await liveUpdate(req, id)
  const claim = now?.claim ?? idOf(doc.claim)
  if (!claim) return doc
  const reviewed = Boolean(now?.counts && (!before?.counts || before.rating !== now.rating))
  if (now && reviewed) {
    // The latest update sets the claim's rating, so it changes it; an older one only fills in.
    const latest = (await countingUpdates(req, claim))[0]
    const outcome = latest?.id === id ? 'changed' : 'updated'
    await recordReview(req, claim, outcome, now.rating)
  }
  // A new date, or a move from another claim, can change this claim's rating
  // without a review above. Holding or removing an update records none.
  await syncClaim(req, claim, { reviewIfChanged: !reviewed && Boolean(now?.counts) })
  if (before?.claim && before.claim !== claim) await syncClaim(req, before.claim)
  return doc
}

/** Who asked for the import running this save, if one is: it runs as the system. */
const importedBy = (req: PayloadRequest): string | null => {
  const id: unknown = req.context.requestedBy
  return typeof id === 'string' ? id : null
}

/** The claims being deleted for good in this request. */
const deletingClaims = (req: PayloadRequest): Set<string> => {
  const found: unknown = req.context.deletingClaims
  if (found instanceof Set) return found as Set<string>
  const made = new Set<string>()
  req.context.deletingClaims = made
  return made
}

const syncOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const claim = idOf(doc.claim)
  // A claim being deleted takes its updates with it, and has nothing to sync.
  if (claim && !deletingClaims(req).has(claim)) await syncClaim(req, claim)
  return doc
}

/**
 * A claim deleted for good takes its updates and rating reviews with it:
 * they belong to it, and cannot point at nothing. Moving a claim to the
 * trash keeps them, so restoring it brings its history back.
 */
export const deleteClaimHistory: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const claim = String(id)
  // One request may delete several claims, so each is noted.
  deletingClaims(req).add(claim)
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

/** Updates are public with their claim, once ready and published in the language, until the claim is trashed. */
const readUpdates = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || {
    and: [
      { recordStatus: { equals: 'ready' } },
      { _status: { equals: 'published' } },
      { 'claim.recordStatus': { equals: 'ready' } },
      // A claim in the trash takes its updates with it.
      { 'claim.deletedAt': { exists: false } },
    ],
  }

/** Ids are UUIDs. Anything else names no claim, and would fail the query. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const textOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null

/**
 * `GET /api/claim-updates/rating-choices?claim={id}`: the ratings on a claim's
 * scale, in scale order and the editor's language, for the update form's picker.
 */
const ratingChoices: Endpoint = {
  path: '/rating-choices',
  method: 'get',
  handler: async (req) => {
    if (!can.rateClaims({ req })) {
      return Response.json({ error: 'You cannot rate claims.' }, { status: 403 })
    }
    const claim = req.searchParams.get('claim') ?? ''
    if (!UUID.test(claim)) return Response.json({ choices: [] })
    const { docs } = await req.payload.find({
      collection: 'claims',
      where: { id: { equals: claim } },
      select: { type: true },
      depth: 0,
      limit: 1,
      trash: true,
      // The rater may read every claim. This reads only its type.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    const typeId = idOf(docs[0]?.type)
    if (!typeId) return Response.json({ choices: [] })
    const types = await req.payload.find({
      collection: 'claim-types',
      where: { id: { equals: typeId } },
      depth: 1,
      limit: 1,
      ...(req.locale ? { locale: req.locale as 'en' } : {}),
      // Reads the claim's scale, as checkUpdate does.
      overrideAccess: true,
      req: { ...req } as PayloadRequest,
    })
    const scale: unknown = types.docs[0]?.ratingScale
    const ratings: unknown =
      scale && typeof scale === 'object' ? Reflect.get(scale, 'ratings') : null
    const choices: RatingChoice[] = Array.isArray(ratings)
      ? ratings.flatMap((r: unknown) => {
          const rating = r && typeof r === 'object' ? (r as Record<string, unknown>) : {}
          const slug = textOrNull(rating.slug)
          if (!slug) return []
          return [
            {
              slug,
              label: textOrNull(rating.label) ?? slug,
              colour: textOrNull(rating.colour),
              textColour: textOrNull(rating.textColour),
              retired: Boolean(rating.retired),
            },
          ]
        })
      : []
    return Response.json({ choices }, { headers: { 'Cache-Control': 'no-store' } })
  },
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
    endpoints: [ratingChoices],
    access: {
      read: readUpdates,
      // Rating a claim, which is what an update does (section 13.2).
      create: can.rateClaims,
      update: can.rateClaims,
      delete: can.deleteRecords,
    },
    hooks: {
      beforeChange: [rememberLive, checkUpdate],
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
            admin: {
              description: 'The rating as of that date, from the claim’s scale.',
              // Picks from the chosen claim's scale. The value stays the rating's
              // slug, which checkUpdate still checks for imports and the API.
              components: { Field: '@promisetracker/plugin-core/client#RatingPicker' },
            },
          },
          {
            name: 'kind',
            type: 'select',
            options: UPDATE_KINDS.map((value) => ({ label: value, value })),
            admin: {
              description:
                'Choose correction when it fixes our own earlier mistake. Otherwise set for you: first rating or change, by date.',
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
    if (!UUID.test(id)) {
      return Response.json({ error: 'There is no such claim.' }, { status: 404 })
    }
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
    // The review and the claim's last-reviewed date save together, or not at all.
    const started = await initTransaction(req)
    try {
      const lastReviewedAt = await recordReview(
        req,
        id,
        'confirmed',
        typeof claim.currentRating === 'string' ? claim.currentRating : null,
      )
      await syncClaim(req, id)
      if (started) await commitTransaction(req)
      return Response.json({ lastReviewedAt })
    } catch (error) {
      if (started) await killTransaction(req)
      throw error
    }
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
  // One refresh per country is enough: a new one replaces any still waiting,
  // so an import of many rows leaves one job, not one per row.
  concurrency: {
    key: ({ input }: { input: { country: string } }) => `refreshCounts:${input.country}`,
    exclusive: true,
    supersedes: true,
  },
  retries: 2,
  handler: async ({ input, req }: { input: { country: string }; req: PayloadRequest }) => {
    const code = input.country
    await refreshTags([`claims:${code}`, `actors:${code}`, `country:${code}`, 'topics'], req)
    return { output: {} }
  },
}

// An update names its rating by slug on its claim's scale. This tells the
// rating scales which claims gave a rating in an update, trashed ones too,
// since they can be restored, so one still in a claim's history is retired
// rather than deleted.
setRatingHistoryUsage(async ({ req, scale, rating }) => {
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
  const { docs: updates } = await req.payload.find({
    collection: 'claim-updates',
    where: { rating: { equals: rating } },
    depth: 0,
    pagination: false,
    select: { claim: true },
    trash: true,
    // Every update giving the rating, for the editor of the scale.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  const ids = [...new Set(updates.map((u) => idOf(u.claim)).filter((id) => id !== null))]
  if (ids.length === 0) return []
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: {
      and: [{ id: { in: ids } }, { type: { in: types.docs.map((t) => t.id) } }],
    },
    depth: 0,
    pagination: false,
    select: { title: true, slug: true },
    trash: true,
    // Names the claims, for the editor of the scale.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return docs.map((doc) => ({ id: String(doc.id), title: String(doc.title ?? doc.slug ?? doc.id) }))
})
