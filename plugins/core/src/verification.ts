import type {
  AdapterContext,
  ClaimForVerification,
  VerdictUpdate,
  VerificationProvider,
} from '@promisetracker/kernel'
import { isSuperAdmin } from '@promisetracker/kernel'
import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  FieldHook,
  Payload,
  PayloadRequest,
} from 'payload'
import { commitTransaction, initTransaction, killTransaction } from 'payload'
import { afterCommit } from './afterCommit'
import { refreshTags } from './cache'
import { countryCode, idOf } from './places'
import { editorEmails, recomputeAndCascade } from './publishing'

/**
 * Verification through an outside system (section 5): claims go out when they
 * are created, and verdicts come back through `applyVerdictUpdates`. With the
 * native adapter, which sends nothing out, none of this does anything.
 */

type VerificationWiring = {
  adapter: VerificationProvider
  context: (payload: Payload, signal?: AbortSignal) => Promise<AdapterContext>
}

let wiring: VerificationWiring | null = null

/** Set once at start-up, with the adapter the kernel chose and its plugin's settings. */
export function setVerification(next: VerificationWiring): void {
  wiring = next
}

type Doc = Record<string, unknown>

const asRecord = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})

const atPath = (doc: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => asRecord(value)[key], doc)

/** The reference paths of the adapter in use, when it sends claims out. */
function reference(): NonNullable<VerificationProvider['reference']> | null {
  return wiring?.adapter.reference ?? null
}

/** The plugin's group on the claim, such as `check`. */
const groupOf = (path: string): string => path.split('.')[0] ?? path

/** `{ check: { itemId: … } }` from `check.itemId`, one level deep, as plugin groups are. */
function nested(values: Record<string, unknown>): Doc {
  const out: Doc = {}
  for (const [path, value] of Object.entries(values)) {
    const [group, field] = path.split('.')
    if (!group || !field) continue
    out[group] = { ...asRecord(out[group]), [field]: value }
  }
  return out
}

const defaultLocale = (payload: Payload): string | undefined => {
  const localization = payload.config.localization
  return localization ? localization.defaultLocale : undefined
}

/** The live claim's verification and plugin group, in one language. */
async function liveClaim(req: PayloadRequest, id: string, locale?: string): Promise<Doc | null> {
  const ref = reference()
  const select: Record<string, true> = { verification: true, country: true, recordStatus: true }
  if (ref) select[groupOf(ref.externalId)] = true
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: id } },
    select,
    depth: 0,
    limit: 1,
    trash: true,
    ...(locale ? { locale: locale as 'all' } : {}),
    // The system reads the live claim, whoever is signed in.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return docs[0] ? (docs[0] as unknown as Doc) : null
}

const SYSTEM_FIELDS = ['verdict', 'date', 'rationale', 'reportUrl', 'verifiedBy'] as const

/**
 * While a plugin owns the verdict, a save of the claim keeps the live
 * verification and plugin group. With drafts, Payload builds a save from the
 * latest version, which does not have what the plugin wrote to the claim. A
 * super-admin's change goes through, and the kernel logs it (section 4.5).
 */
export const keepVerificationInStep: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const ref = reference()
  const id = idOf(originalDoc?.id)
  if (!ref || operation !== 'update' || !id || isSuperAdmin(req.user)) return data
  const live = await liveClaim(req, id, req.locale ?? undefined)
  if (!live) return data
  const group = groupOf(ref.externalId)
  const verification = { ...asRecord(data.verification) }
  const liveVerification = asRecord(live.verification)
  for (const field of SYSTEM_FIELDS) verification[field] = liveVerification[field] ?? null
  return { ...data, verification, [group]: live[group] ?? null }
}

/**
 * What the admin shows for a group the system writes to the live claim: the
 * live value, not the latest version's (as `fromLiveClaim` does for ratings).
 */
export const fromLiveGroup =
  (group: string, field?: string): FieldHook =>
  async ({ value, siblingData, originalDoc, req, findMany }) => {
    const id = idOf(asRecord(originalDoc).id) ?? idOf(asRecord(siblingData).id)
    if (!req.user || !id || findMany || !reference()) return value
    const live = await liveClaim(req, id, req.locale ?? undefined)
    if (!live || !(group in live)) return value
    if (field === undefined) return live[group]
    const own = asRecord(live[group])
    return field in own ? own[field] : value
  }

/** Queues a new claim to go out for verification once its save commits. */
export const submitOnCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !reference()) return doc
  const id = idOf(doc.id)
  if (!id) return doc
  await afterCommit(req, async () => {
    // Whoever created the claim, it goes out as the system.
    await req.payload.jobs.queue({
      task: 'submitForVerification' as never,
      input: { claim: id } as never,
      overrideAccess: true,
    })
  })
  return doc
}

const titleOf = (value: unknown): string | null => {
  const title = asRecord(value).title ?? asRecord(value).name
  return typeof title === 'string' && title ? title : null
}
const slugOf = (value: unknown): string | null => {
  const slug = asRecord(value).slug ?? asRecord(value).code
  return typeof slug === 'string' && slug ? slug.toLowerCase() : null
}

/** What goes out: the claim in its default language, with a link back to it. */
export async function claimForVerification(
  payload: Payload,
  id: string,
): Promise<ClaimForVerification | null> {
  const locale = defaultLocale(payload)
  const claim = (await payload
    .findByID({
      collection: 'claims',
      id,
      depth: 1,
      trash: true,
      ...(locale ? { locale: locale as 'en' } : {}),
      // The system reads the claim to send it out.
      overrideAccess: true,
    })
    .catch(() => null)) as Doc | null
  if (!claim) return null
  const country = slugOf(claim.country)
  const base = (payload.config.serverURL ?? '').replace(/\/$/, '')
  const path = country && claim.slug ? `/${locale ?? 'en'}/${country}/p/${String(claim.slug)}` : ''
  const title = typeof claim.title === 'string' ? claim.title : ''
  const statement = typeof claim.statement === 'string' && claim.statement ? claim.statement : title
  const summary = typeof claim.summary === 'string' && claim.summary ? claim.summary : undefined
  const tags = [slugOf(claim.topic), slugOf(claim.type), country].filter(
    (tag): tag is string => tag !== null,
  )
  return {
    id,
    title: title || titleOf(claim) || id,
    statement,
    ...(summary ? { summary } : {}),
    tags,
    url: `${base}${path}`,
  }
}

/** Stores the claim's reference in the plugin's group, on the live claim. */
async function storeReference(
  req: PayloadRequest,
  id: string,
  values: Record<string, unknown>,
): Promise<void> {
  const ref = reference()
  if (!ref) return
  const live = await liveClaim(req, id)
  const group = groupOf(ref.externalId)
  const update = nested(values)
  await req.payload.db.updateOne({
    collection: 'claims',
    id,
    // The whole group, so the fields left out keep their values.
    data: { [group]: { ...asRecord(live?.[group]), ...asRecord(update[group]) } },
    req,
    returning: false,
  })
}

/**
 * Sends a claim out (section 5.2). A claim that already went out is left
 * alone, so a retry never sends it twice. While the service is down the job
 * waits and retries, which is the local queue section 5.2 asks for.
 */
export const submitForVerificationTask = {
  slug: 'submitForVerification',
  inputSchema: [{ name: 'claim', type: 'text' as const, required: true }],
  retries: { attempts: 8, backoff: { type: 'exponential' as const, delay: 60_000 } },
  handler: async ({ input, req }: { input: { claim: string }; req: PayloadRequest }) => {
    const ref = reference()
    if (!wiring || !ref) return { output: { sent: false } }
    const live = await liveClaim(req, input.claim)
    if (!live) return { output: { sent: false } }
    if (atPath(live, ref.externalId)) return { output: { sent: false } }
    const claim = await claimForVerification(req.payload, input.claim)
    if (!claim) return { output: { sent: false } }
    const ctx = await wiring.context(req.payload)
    const { externalId, url } = await wiring.adapter.submit(claim, ctx)
    await storeReference(req, input.claim, {
      [ref.externalId]: externalId,
      ...(ref.url && url ? { [ref.url]: url } : {}),
      ...(ref.syncedAt ? { [ref.syncedAt]: new Date().toISOString() } : {}),
    })
    return { output: { sent: true } }
  },
}

export type VerdictOutcome = {
  externalId: string
  /** The claim the update names, or null when no claim has its reference. */
  claim: string | null
  /** Whether the claim changed. A repeat of the same verdict changes nothing. */
  changed: boolean
}

/** The claim whose reference is `externalId`. */
async function claimFor(req: PayloadRequest, externalId: string): Promise<string | null> {
  const ref = reference()
  if (!ref || !externalId) return null
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { [ref.externalId]: { equals: externalId } },
    select: {},
    depth: 0,
    limit: 1,
    trash: true,
    // Matches the outside system's reference, for the system.
    overrideAccess: true,
    req: { ...req } as PayloadRequest,
  })
  return idOf(docs[0]?.id)
}

const sameInstant = (a: unknown, b: unknown): boolean =>
  Boolean(a) && Boolean(b) && new Date(String(a)).getTime() === new Date(String(b)).getTime()

async function tellEditors(req: PayloadRequest, id: string, title: string): Promise<void> {
  const link = `${req.payload.config.serverURL ?? ''}/admin/collections/claims/${id}`
  const subject = `Verdict withdrawn: ${title}`
  const text = [
    `The fact-check report for "${title}" was unpublished, so its verdict was withdrawn.`,
    'The claim is now unverified and on hold, off the public site.',
    `Look at it here: ${link}`,
  ].join('\n\n')
  await afterCommit(req, async () => {
    try {
      const to = await editorEmails(req.payload)
      if (to.length > 0) await req.payload.sendEmail({ to, subject, text })
    } catch (error) {
      // An email that fails never undoes the verdict.
      req.payload.logger.error({ err: error, msg: `Could not send "${subject}"` })
    }
  })
}

/**
 * Applies one verdict to its claim, on the live record (section 5.2). A
 * withdrawn verdict makes the claim unverified, holds it and tells an editor.
 */
async function applyOne(req: PayloadRequest, update: VerdictUpdate): Promise<VerdictOutcome> {
  const id = await claimFor(req, update.externalId)
  if (!id) return { externalId: update.externalId, claim: null, changed: false }
  const locale = defaultLocale(req.payload) ?? 'en'
  // Every language, since the database takes a translated field as one value per language.
  const live = await liveClaim(req, id, 'all')
  if (!live) return { externalId: update.externalId, claim: null, changed: false }
  const stored = asRecord(live.verification)
  const rationales = asRecord(stored.rationale)

  let verification: Doc
  let recordStatus: unknown = live.recordStatus
  if (update.withdrawn) {
    if (stored.verdict === 'unverified' && live.recordStatus === 'hold') {
      return { externalId: update.externalId, claim: id, changed: false }
    }
    verification = { ...stored, verdict: 'unverified', date: new Date().toISOString() }
    recordStatus = 'hold'
  } else {
    const date =
      update.verifiedAt ??
      (stored.verdict === update.verdict && stored.date ? String(stored.date) : null) ??
      new Date().toISOString()
    // Check's report is in one language, the deployment's default.
    const rationale = update.rationale ?? rationales[locale] ?? null
    const reportUrl = update.reportUrl ?? null
    const unchanged =
      stored.verdict === update.verdict &&
      sameInstant(stored.date, date) &&
      (rationales[locale] ?? null) === rationale &&
      (stored.reportUrl ?? null) === reportUrl
    if (unchanged) return { externalId: update.externalId, claim: id, changed: false }
    verification = {
      ...stored,
      verdict: update.verdict,
      date,
      rationale: { ...rationales, [locale]: rationale },
      reportUrl,
    }
  }
  // The plugin set the verdict, not a person.
  verification.verifiedBy = null

  // The verdict and what follows from it save together, or not at all.
  const started = await initTransaction(req)
  try {
    // Written to the live claim, as claim updates write its rating: a verdict
    // from outside is no edit of the claim, and must not publish its draft.
    await req.payload.db.updateOne({
      collection: 'claims',
      id,
      data: { verification, recordStatus },
      req,
      returning: false,
    })
    await recomputeAndCascade(req, 'claims', id)
    const code = await countryCode(req, live.country)
    if (code) await refreshTags([`claims:${code}`, `actors:${code}`, `country:${code}`], req)
    if (update.withdrawn) {
      const claim = await claimForVerification(req.payload, id)
      await tellEditors(req, id, claim?.title ?? id)
    }
    if (started) await commitTransaction(req)
  } catch (error) {
    if (started) await killTransaction(req)
    throw error
  }
  return { externalId: update.externalId, claim: id, changed: true }
}

/**
 * Applies verdicts from the outside system. An update for a claim PromiseTracker
 * does not know is skipped, and reported back with no claim.
 */
export async function applyVerdictUpdates(
  req: PayloadRequest,
  updates: readonly VerdictUpdate[],
): Promise<VerdictOutcome[]> {
  const outcomes: VerdictOutcome[] = []
  for (const update of updates) outcomes.push(await applyOne(req, update))
  return outcomes
}

/** Records when the plugin last heard about a claim, and what it heard. */
export async function recordSync(
  req: PayloadRequest,
  claim: string,
  values: Record<string, unknown>,
): Promise<void> {
  await storeReference(req, claim, values)
}
