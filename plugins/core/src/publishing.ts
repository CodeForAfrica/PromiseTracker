import type {
  Access,
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionConfig,
  CollectionSlug,
  Field,
  FieldHook,
  Payload,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError, commitTransaction, initTransaction, killTransaction } from 'payload'

import type { RecordStatus } from './access'
import { maySetRecordStatus, signedIn, userCan } from './access'
import { afterCommit } from './afterCommit'
import { refreshTags } from './cache'

/**
 * Publishing rules (section 8).
 *
 * `recordStatus` is what an editor wants. `publishedIn` is what the system
 * works out: the languages a record is live in. A record is published in a
 * language when it is ready, its required localized fields are published in
 * that language in Payload, every record above it is published in that
 * language, and it passes its record type's checks.
 *
 * The public site asks one question of every list, "is this published in
 * this language?", through `publishedInLocale`, and never checks parents. The
 * parents are folded in here, on save, and by the cascade when a parent
 * changes (section 8.2).
 */

export const RECORD_STATUSES = [
  'ready',
  'hold',
  'archived',
] as const satisfies readonly RecordStatus[]

/** A localized field's value in every language, as Payload returns it with `locale: 'all'`. */
type PerLocale = Readonly<Record<string, unknown>>

type Doc = Record<string, unknown>

const isFilled = (value: unknown): boolean =>
  typeof value === 'string' ? value.trim().length > 0 : value !== null && value !== undefined

/**
 * The languages a record is published in on its own account: none unless it
 * is ready, then each language in which every required localized field has a
 * value. Parents and checks narrow this further.
 */
export function computePublishedIn(
  status: unknown,
  required: Readonly<Record<string, PerLocale>>,
  locales: readonly string[],
): string[] {
  if (status !== 'ready') return []
  const fields = Object.values(required)
  return locales.filter((locale) => fields.every((values) => isFilled(values[locale])))
}

/** Records published in this language. Every public query uses it. */
export const publishedInLocale = (locale: string): Where => ({
  publishedIn: { in: [locale] },
})

/** Staff read everything. A guest reads only records an editor has marked ready. */
export const readReadyOrStaff = ({ req }: { req: PayloadRequest }): boolean | Where =>
  signedIn({ req }) || { recordStatus: { equals: 'ready' } }

const asRecord = (value: unknown): Doc => (value && typeof value === 'object' ? (value as Doc) : {})

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string' && value) return value
  const id: unknown = value && typeof value === 'object' ? Reflect.get(value, 'id') : null
  return typeof id === 'string' ? id : null
}

/** A record above another, through one of its relationship fields (section 8.1). */
export type ParentLink = {
  field: string
  collection: string
  /** A parent the record may have none of, such as a claim's source document. */
  optional?: boolean
}

/** Why a record cannot be published, in words an editor can act on. */
export type PublishingCheck = (
  record: Doc,
  context: { payload: Payload; req: Partial<PayloadRequest> },
) => Promise<string[]> | string[]

export type PublishingRules = {
  /** Localized fields that must have a value in a language for the record to be live in it. */
  required: readonly string[]
  /** The records above it. It is live only in languages they are live in. */
  parents?: readonly ParentLink[]
  /** Checks of its own, such as a claim's topic and source. */
  checks?: PublishingCheck
  /**
   * Whether the record has a status of its own. Areas have none: they are
   * public wherever their country is.
   */
  status?: boolean
  /** Payload's drafts, so each language is published on its own (section 8.1). */
  drafts?: boolean
  /** The status a new record starts with. Hold, unless the record type is never public itself. */
  defaultStatus?: RecordStatus
}

/** The parents table: every record type with publishing rules, and what sits above it. */
const RULES = new Map<string, PublishingRules>()

/** Record types with publishing rules, parents before children. */
export const publishedTypes = (): string[] => {
  const order: string[] = []
  const visit = (slug: string) => {
    if (order.includes(slug)) return
    for (const parent of RULES.get(slug)?.parents ?? []) visit(parent.collection)
    if (RULES.has(slug)) order.push(slug)
  }
  for (const slug of RULES.keys()) visit(slug)
  return order
}

/** The record types that sit under one, and the field that points up to it. */
export const childrenOf = (slug: string): { collection: string; field: string }[] =>
  [...RULES].flatMap(([child, rules]) =>
    (rules.parents ?? [])
      .filter((parent) => parent.collection === slug)
      .map((parent) => ({ collection: child, field: parent.field })),
  )

/**
 * Payload types its local API from the app's generated types, which a plugin
 * cannot see. The publishing code works on any record type, so these few
 * reads and writes take a slug as text, through one cast each.
 */
type AnyFindByID = (args: Record<string, unknown>) => Promise<Doc>
type AnyFind = (args: Record<string, unknown>) => Promise<{ docs: Doc[]; hasNextPage: boolean }>
const findByID = (payload: Payload) => payload.findByID.bind(payload) as unknown as AnyFindByID
const find = (payload: Payload) => payload.find.bind(payload) as unknown as AnyFind

/** A record's languages in Payload's draft system: those it is published in. */
function payloadPublished(doc: Doc, locales: readonly string[]): string[] {
  const status = doc._status
  if (typeof status === 'string') return status === 'published' ? [...locales] : []
  const byLocale = asRecord(status)
  return locales.filter((locale) => byLocale[locale] === 'published')
}

/**
 * Works out where a record is live, and why it is not when it fails a check.
 * The record is read with every language.
 */
export async function computePublishing(
  payload: Payload,
  slug: string,
  doc: Doc,
  req: Partial<PayloadRequest> = {},
): Promise<{ publishedIn: string[]; problems: string[] }> {
  const rules = RULES.get(slug)
  if (!rules) return { publishedIn: [], problems: [] }
  const locales = payload.config.localization ? payload.config.localization.localeCodes : []
  const problems = rules.checks ? await rules.checks(doc, { payload, req }) : []
  // A record in the trash, or not ready, is live nowhere.
  if (doc.deletedAt || (rules.status !== false && doc.recordStatus !== 'ready')) {
    return { publishedIn: [], problems }
  }
  const required = Object.fromEntries(
    rules.required.map((name) => [name, asRecord(doc[name]) as PerLocale]),
  )
  let languages = computePublishedIn('ready', required, locales)
  // A record type with no required text, such as an actor, has nothing to
  // publish per language: it is live wherever its parents are. Payload's
  // "publish all languages" covers only the languages switched on today, so
  // its status would leave out a language switched on later.
  if (rules.drafts && rules.required.length > 0) {
    const published = payloadPublished(doc, locales)
    languages = languages.filter((locale) => published.includes(locale))
  }
  for (const parent of rules.parents ?? []) {
    if (languages.length === 0) break
    const id = idOf(doc[parent.field])
    if (!id) {
      if (!parent.optional) languages = []
      continue
    }
    const { docs } = await find(payload)({
      collection: parent.collection,
      where: { id: { equals: id } },
      select: { publishedIn: true },
      depth: 0,
      limit: 1,
      // Reads where the parent is live, whoever saved the record.
      overrideAccess: true,
      req,
    })
    const live = docs[0]?.publishedIn
    const parentIn = Array.isArray(live) ? live : []
    languages = languages.filter((locale) => parentIn.includes(locale))
  }
  return { publishedIn: problems.length > 0 ? [] : languages, problems }
}

const sameSet = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value) => b.includes(value))

/**
 * Works out a stored record's published status again, and writes it if it
 * changed. Written straight to the database: it follows from the record and
 * its parents, so it is no edit, and it adds no version.
 */
export async function recomputePublishing(
  payload: Payload,
  slug: string,
  id: string,
  req: Partial<PayloadRequest> = {},
): Promise<{
  before: string[]
  after: string[]
  problems: string[]
  changed: boolean
  /** The record's country, to refresh its pages. */
  country: string | null
}> {
  const doc = await findByID(payload)({
    collection: slug,
    id,
    locale: 'all',
    depth: 0,
    // The published record, not a draft saved since.
    draft: false,
    // A record in the trash is live nowhere, and is still worked out.
    trash: true,
    // Reads the record to work out where it is live, whoever saved it.
    overrideAccess: true,
    // A copy: reading every language would switch the save itself to every
    // language. The copy shares the transaction.
    req: { ...req },
  })
  const before = Array.isArray(doc.publishedIn) ? (doc.publishedIn as string[]) : []
  const { publishedIn, problems } = await computePublishing(payload, slug, doc, req)
  const problemText = problems.length > 0 ? problems.join('\n') : null
  const changed = !sameSet(before, publishedIn)
  const hasChecks = Boolean(RULES.get(slug)?.checks)
  if (changed || (hasChecks && (doc.publishingProblems ?? null) !== problemText)) {
    await payload.db.updateOne({
      // The slug is one of the record types with publishing rules.
      collection: slug as CollectionSlug,
      id,
      data: hasChecks ? { publishedIn, publishingProblems: problemText } : { publishedIn },
      req,
      returning: false,
    })
  }
  const country = slug === 'countries' ? idOf(doc.id) : idOf(doc.country)
  return { before, after: publishedIn, problems, changed, country }
}

/** The tags of every page a country's records appear on (section 17). */
export async function countryTags(
  payload: Payload,
  slug: string,
  doc: Doc,
  req: Partial<PayloadRequest> = {},
): Promise<string[]> {
  const countryId = slug === 'countries' ? idOf(doc.id) : idOf(doc.country)
  if (!countryId) return []
  const { docs } = await find(payload)({
    collection: 'countries',
    where: { id: { equals: countryId } },
    select: { code: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the country's code only, to name the pages to refresh.
    overrideAccess: true,
    req,
  })
  const code = docs[0]?.code
  if (typeof code !== 'string') return []
  return [
    'countries',
    'topics',
    `country:${code}`,
    `places:${code}`,
    `actors:${code}`,
    `claims:${code}`,
  ]
}

/** Records the cascade works through in one transaction (section 8.2). */
export const CASCADE_BATCH = 100

/**
 * Works through everything under a record whose published status changed, in
 * batches, each inside a transaction, refreshing the site's pages after each
 * (section 8.2). A record under it that changes passes the change on.
 */
export async function cascadePublishing(
  payload: Payload,
  root: { collection: string; id: string },
): Promise<{ recomputed: number; changed: number }> {
  const rootDoc = await findByID(payload)({
    collection: root.collection,
    id: root.id,
    depth: 0,
    trash: true,
    // The cascade runs as the system, after the save that started it.
    overrideAccess: true,
  })
  const tags = await countryTags(payload, root.collection, rootDoc)
  const queue = [root]
  // A record changed by several parents, such as a claim under a held country
  // and its actor, passes its change on once.
  const queued = new Set([`${root.collection}:${root.id}`])
  const order = publishedTypes()
  let recomputed = 0
  let changed = 0
  for (let next = queue.shift(); next; next = queue.shift()) {
    // Parents first, so a claim is worked out after its actor has been.
    const children = childrenOf(next.collection).sort(
      (a, b) => order.indexOf(a.collection) - order.indexOf(b.collection),
    )
    for (const child of children) {
      for (let page = 1; ; page += 1) {
        // Paged by id, which no recompute changes, so no record is skipped or
        // seen twice while the batches before it are written.
        const { docs, hasNextPage } = await find(payload)({
          collection: child.collection,
          where: { [child.field]: { equals: next.id } },
          select: { id: true },
          sort: 'id',
          depth: 0,
          limit: CASCADE_BATCH,
          page,
          trash: true,
          // The cascade runs as the system.
          overrideAccess: true,
        })
        const req: Partial<PayloadRequest> & { payload: Payload } = { payload }
        await initTransaction(req)
        try {
          for (const doc of docs) {
            const id = idOf(doc.id)
            if (!id) continue
            const result = await recomputePublishing(payload, child.collection, id, req)
            recomputed += 1
            const key = `${child.collection}:${id}`
            if (result.changed) {
              changed += 1
              if (!queued.has(key)) {
                queued.add(key)
                queue.push({ collection: child.collection, id })
              }
            }
          }
          await commitTransaction(req)
        } catch (error) {
          await killTransaction(req).catch(() => undefined)
          throw error
        }
        // The batch is committed, so the site can read it. Refreshed now, not at
        // the end. The refresh reads only `req.payload` and the transaction.
        if (tags.length > 0) await refreshTags(tags, req as PayloadRequest)
        if (!hasNextPage) break
      }
    }
  }
  // Figures follow published claims, so their pages are refreshed too (section 9.8).
  const code = tags.find((tag) => tag.startsWith('country:'))?.slice('country:'.length)
  if (code && changed > 0) {
    // The cascade runs as the system, after whoever saved was checked.
    await payload.jobs.queue({
      task: 'refreshCounts',
      input: { country: code },
      overrideAccess: true,
    })
  }
  return { recomputed, changed }
}

/** The job that runs the cascade. A save starts it at once (section 8.2). */
export const cascadePublishingTask = {
  slug: 'cascadePublishing',
  inputSchema: [
    { name: 'collection', type: 'text' as const, required: true },
    { name: 'id', type: 'text' as const, required: true },
  ],
  outputSchema: [
    { name: 'recomputed', type: 'number' as const },
    { name: 'changed', type: 'number' as const },
  ],
  retries: 2,
  handler: async ({
    input,
    req,
  }: {
    input: { collection: string; id: string }
    req: PayloadRequest
  }) => ({ output: await cascadePublishing(req.payload, input) }),
}

/**
 * Works out every record's published status again, parents first: for when
 * the required fields or the registered languages change. A save only works
 * out its own record.
 */
export async function recomputeAll(
  payload: Payload,
  only?: readonly string[],
  /** A request whose transaction to use, as a migration has. Without one, each batch has its own. */
  outer?: PayloadRequest,
): Promise<Record<string, { recomputed: number; changed: number }>> {
  const result: Record<string, { recomputed: number; changed: number }> = {}
  for (const slug of publishedTypes()) {
    if (only && !only.includes(slug)) continue
    const counts = { recomputed: 0, changed: 0 }
    for (let page = 1; ; page += 1) {
      // Paged by id, which no recompute changes.
      const { docs, hasNextPage } = await find(payload)({
        collection: slug,
        select: { id: true },
        sort: 'id',
        depth: 0,
        limit: CASCADE_BATCH,
        page,
        trash: true,
        // Recomputing is the system's own work.
        overrideAccess: true,
        ...(outer ? { req: outer } : {}),
      })
      const req: Partial<PayloadRequest> & { payload: Payload } = outer ?? { payload }
      if (!outer) await initTransaction(req)
      const countries = new Set<string>()
      try {
        for (const doc of docs) {
          const id = idOf(doc.id)
          if (!id) continue
          const { changed, country } = await recomputePublishing(payload, slug, id, req)
          counts.recomputed += 1
          if (changed) {
            counts.changed += 1
            if (country) countries.add(country)
          }
        }
        if (!outer) await commitTransaction(req)
      } catch (error) {
        if (!outer) await killTransaction(req).catch(() => undefined)
        throw error
      }
      // Records changed without a save, so their pages are refreshed here. Once
      // the batch commits, or with the migration that started it.
      for (const country of countries) {
        const tags = await countryTags(payload, 'countries', { id: country }, req)
        if (tags.length > 0) await refreshTags(tags, req as PayloadRequest)
      }
      if (!hasNextPage) break
    }
    result[slug] = counts
  }
  return result
}

/** The job that works out every record again, for one record type or all of them. */
export const recomputePublishingTask = {
  slug: 'recomputePublishing',
  inputSchema: [{ name: 'collections', type: 'text' as const, hasMany: true }],
  retries: 0,
  handler: async ({
    input,
    req,
  }: {
    input: { collections?: string[] | null }
    req: PayloadRequest
  }) => {
    const only = input.collections?.length ? input.collections : undefined
    await recomputeAll(req.payload, only)
    return { output: {} }
  },
}

/**
 * Refuses a status the user may not set. A contributor may only hold (section
 * 13.2). A new record keeping its type's default is no choice of theirs, so a
 * contributor may upload a document, which starts ready.
 */
const checkStatus =
  (defaultValue: RecordStatus): FieldHook =>
  ({ value, previousValue, req, operation }) => {
    // A default of ready, as documents have, is a deliberate grant: anyone who
    // may create the record may create it ready.
    if (operation === 'create' && value === defaultValue) return value
    if (req.user && value !== previousValue && typeof value === 'string') {
      if (!maySetRecordStatus(req.user, value as RecordStatus)) {
        throw new APIError(`You cannot set this record to ${value}.`, 403)
      }
    }
    return value
  }

const statusField = (defaultValue: RecordStatus): Field => ({
  name: 'recordStatus',
  type: 'select',
  required: true,
  defaultValue,
  options: RECORD_STATUSES.map((value) => ({ label: value, value })),
  index: true,
  admin: {
    position: 'sidebar',
    description: 'Ready makes it public in each language it is published in.',
  },
  hooks: { beforeChange: [checkStatus(defaultValue)] },
  // Only those who may set a status see it editable: a reviewer, say, does not.
  access: {
    update: ({ req }) =>
      userCan(req.user, 'setAnyRecordStatus') || userCan(req.user, 'holdRecords'),
  },
})

/** The live record's published status, read once per request for the admin's two fields. */
const liveReads = new WeakMap<object, Map<string, Promise<Doc>>>()

function readLive(req: PayloadRequest, slug: string, id: string): Promise<Doc> {
  const reads = liveReads.get(req) ?? new Map<string, Promise<Doc>>()
  liveReads.set(req, reads)
  const key = `${slug}:${id}`
  const cached = reads.get(key)
  if (cached) return cached
  const read = find(req.payload)({
    collection: slug,
    where: { id: { equals: id } },
    select: { publishedIn: true, publishingProblems: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the live record's status for a signed-in user's admin view.
    overrideAccess: true,
    req,
  }).then(({ docs }) => docs[0] ?? {})
  reads.set(key, read)
  return read
}

/**
 * The admin shows the latest version of a record, which never holds the
 * published status: only the system writes it, to the live record. So the
 * admin's fields read the live record. Only staff see them, so guests' reads
 * cost nothing.
 */
const fromLive =
  (slug: string, name: 'publishedIn' | 'publishingProblems'): FieldHook =>
  async ({ siblingData, req }) => {
    const id = idOf(asRecord(siblingData).id)
    if (!req.user || !id) return null
    const value = (await readLive(req, slug, id))[name]
    return name === 'publishedIn'
      ? Array.isArray(value) && value.length > 0
        ? value.join(', ')
        : 'Nowhere yet'
      : typeof value === 'string' && value
        ? value
        : null
  }

const computedFields = (slug: string, checks: boolean): Field[] => [
  {
    name: 'publishedIn',
    type: 'text',
    hasMany: true,
    index: true,
    // Shown through `liveIn`, which reads the live record.
    admin: { hidden: true },
    // Only the system writes it.
    access: { create: () => false, update: () => false },
  },
  {
    name: 'liveIn',
    label: 'Published in',
    type: 'text',
    // Not stored: read from the live record.
    virtual: true,
    admin: {
      position: 'sidebar',
      readOnly: true,
      condition: (data: Doc) => Boolean(data.id),
      description: 'Worked out on save. The languages this record is live in.',
    },
    access: { read: signedIn },
    hooks: { afterRead: [fromLive(slug, 'publishedIn')] },
  },
  ...(checks
    ? [
        {
          name: 'publishingProblems',
          type: 'textarea',
          // Shown through `whyNotPublic`, which reads the live record.
          admin: { hidden: true },
          // Only the system writes it, and only staff read it.
          access: { create: () => false, update: () => false, read: signedIn },
        } satisfies Field,
        {
          name: 'whyNotPublic',
          label: 'Why it is not public',
          type: 'textarea',
          virtual: true,
          admin: {
            position: 'sidebar',
            readOnly: true,
            condition: (data: Doc) => Boolean(data.whyNotPublic),
          },
          access: { read: signedIn },
          hooks: { afterRead: [fromLive(slug, 'publishingProblems')] },
        } satisfies Field,
      ]
    : []),
]

/** Set in a save's context when the system saves a record itself, so it is not reported. */
export const SYSTEM_SAVE = 'promisetracker:systemSave'

/**
 * Saved without `draft`, a record is published, as it was before drafts: in
 * the language being saved. A record type with no required text, such as an
 * actor, is published in every language when it is created, since every
 * language has all it needs. The admin's buttons always say which, so this
 * changes nothing there.
 */
const publishUnlessDraft =
  (everyLanguageOnCreate: boolean): CollectionBeforeOperationHook =>
  ({ args, operation }) => {
    if (operation !== 'create' && operation !== 'update') return args
    if (args.draft) return args
    const data = asRecord(args.data)
    if ('_status' in data) return args
    return {
      ...args,
      data: { ...data, _status: 'published' },
      ...(operation === 'create' && everyLanguageOnCreate ? { publishAllLocales: true } : {}),
    }
  }

/** The people told about status changes: editors and super-admins. */
export async function editorEmails(payload: Payload): Promise<string[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { roles: { in: ['editor', 'super-admin'] } },
    depth: 0,
    pagination: false,
    // Finds who to tell, whoever made the change.
    overrideAccess: true,
  })
  return docs.map((user) => user.email).filter((email): email is string => Boolean(email))
}

/** What a status change is, for the email: archived, restored, or a country on hold. */
export function statusEvent(
  slug: string,
  before: unknown,
  after: unknown,
): 'archived' | 'restored' | 'countryHeld' | null {
  if (before === after || before === undefined) return null
  if (after === 'archived') return 'archived'
  if (before === 'archived') return 'restored'
  if (slug === 'countries' && after === 'hold') return 'countryHeld'
  return null
}

const SUBJECTS = {
  archived: 'Archived',
  restored: 'Restored',
  countryHeld: 'Country on hold',
} as const

/** Emails editors about an archive, a restore, or a country put on hold (section 14). */
async function notifyStatusChange(
  req: PayloadRequest,
  slug: string,
  doc: Doc,
  previousDoc: Doc,
): Promise<void> {
  const event = statusEvent(slug, previousDoc.recordStatus, doc.recordStatus)
  if (!event) return
  const name = [doc.title, doc.name, doc.code, doc.id].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  const who = req.user && 'email' in req.user ? String(req.user.email) : 'The system'
  const kind = slug.replace(/s$/, '').replace(/-/g, ' ')
  const subject = `${SUBJECTS[event]}: ${name ?? kind}`
  const text = [
    `${who} set the ${kind} "${name ?? ''}" to ${String(doc.recordStatus)}.`,
    event === 'countryHeld'
      ? 'Everything in the country is off the public site until it is set to ready again.'
      : event === 'archived'
        ? 'It is off the public site. Setting it to ready again restores it.'
        : 'It is public again in the languages it is published in.',
  ].join('\n\n')
  await afterCommit(req, async () => {
    try {
      const to = await editorEmails(req.payload)
      if (to.length > 0) await req.payload.sendEmail({ to, subject, text })
    } catch (error) {
      // An email that fails never undoes the save.
      req.payload.logger.error({ err: error, msg: `Could not send "${subject}"` })
    }
  })
}

/**
 * Starts the cascade for a record once the save commits, and runs it at once
 * rather than waiting for the worker's next poll (section 8.2).
 */
export async function startCascade(req: PayloadRequest, slug: string, id: string): Promise<void> {
  if (childrenOf(slug).length === 0) return
  await afterCommit(req, async () => {
    // Who changed the record was checked by the save, so the job is queued as the system.
    const job = await req.payload.jobs.queue({
      task: 'cascadePublishing',
      input: { collection: slug, id },
      overrideAccess: true,
    })
    // A worker would also pick it up. Running it here means held records leave
    // the site within seconds, and Payload's lease stops it running twice.
    await req.payload.jobs.runByID({ id: job.id, overrideAccess: true })
  })
}

/**
 * Works out a record's published status again after something it depends on
 * changed outside its own save, such as an actor's first term, and passes a
 * change on to everything under it.
 */
export async function recomputeAndCascade(
  req: PayloadRequest,
  slug: string,
  id: string,
): Promise<void> {
  const { changed } = await recomputePublishing(req.payload, slug, id, req)
  if (changed) {
    const doc = await findByID(req.payload)({
      collection: slug,
      id,
      depth: 0,
      trash: true,
      // Reads the record's country, to refresh its pages.
      overrideAccess: true,
      req,
    })
    const tags = await countryTags(req.payload, slug, doc, req)
    if (tags.length > 0) await refreshTags(tags, req)
    await startCascade(req, slug, id)
  }
}

/**
 * Every day, every record is worked out again, parents first (section 8.2).
 * People whose first term starts that day come onto the record, and their
 * claims with them, by the same whole-day rule a save uses. It also repairs
 * anything a cascade missed, such as one whose job could not be queued. At
 * version 1's size, a few thousand records, it takes seconds.
 */
export const dailyPublishingTask = {
  slug: 'dailyPublishing',
  inputSchema: [],
  retries: 1,
  // Just after midnight UTC, when a term's first day begins.
  schedule: [{ cron: '5 0 * * *', queue: 'default' }],
  handler: async ({ req }: { req: PayloadRequest }) => {
    await recomputeAll(req.payload)
    return { output: {} }
  },
}

/** The languages each record was live in before the save under way, by request. */
const publishedBefore = new WeakMap<object, Map<string, string[]>>()

/**
 * Before a save: notes where the record is live now. With drafts, Payload
 * builds a save from the latest version, which never holds the published
 * status, since only the system writes it, to the live record. So the live
 * record is read, and its status carried through the save unchanged.
 */
const rememberPublishedIn: CollectionBeforeChangeHook = async ({
  collection,
  data,
  originalDoc,
  req,
}) => {
  const id = idOf(originalDoc?.id)
  if (!id) return data
  const { docs } = await find(req.payload)({
    collection: collection.slug,
    where: { id: { equals: id } },
    select: { publishedIn: true },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads where the record is live, whoever saves it.
    overrideAccess: true,
    req,
  })
  const live = docs[0]?.publishedIn
  const publishedIn = Array.isArray(live) ? live : []
  const saves = publishedBefore.get(req) ?? new Map<string, string[]>()
  saves.set(`${collection.slug}:${id}`, publishedIn)
  publishedBefore.set(req, saves)
  return { ...data, publishedIn }
}

/**
 * After a save: works out the record's published status before the save
 * ends, then starts the cascade at once for everything under it, without
 * waiting for the worker's next poll (section 8.2).
 */
const recomputeOnSave: CollectionAfterChangeHook = async ({
  collection,
  doc,
  previousDoc,
  req,
  operation,
  context,
}) => {
  const slug = collection.slug
  const { after, problems } = await recomputePublishing(req.payload, slug, String(doc.id), req)
  const key = `${slug}:${String(doc.id)}`
  const before = publishedBefore.get(req)?.get(key) ?? []
  publishedBefore.get(req)?.delete(key)
  if (operation === 'update' && !sameSet(before, after)) {
    await startCascade(req, slug, String(doc.id))
  }
  if (operation === 'update' && !context[SYSTEM_SAVE]) {
    await notifyStatusChange(req, slug, doc, asRecord(previousDoc))
  }
  // The admin's fields read the live record before this hook runs, so the
  // save's answer would show the old status. They are set from the new one.
  liveReads.get(req)?.delete(`${slug}:${String(doc.id)}`)
  const problemText = problems.length > 0 ? problems.join('\n') : null
  return {
    ...doc,
    publishedIn: after,
    publishingProblems: problemText,
    ...(req.user
      ? {
          liveIn: after.length > 0 ? after.join(', ') : 'Nowhere yet',
          ...(RULES.get(slug)?.checks ? { whyNotPublic: problemText } : {}),
        }
      : {}),
  }
}

/**
 * Trash first (section 8.6): whoever may delete a record moves it to the
 * trash, from where it can be restored. Only a super-admin deletes for good.
 */
export const trashFirst =
  (rule: Access): Access =>
  (args) =>
    args.data?.deletedAt ? rule(args) : userCan(args.req.user, 'manageUsers')

/** Puts a record type in the trash first, and keeps its delete rule for trashing. */
export function withTrash(collection: CollectionConfig): CollectionConfig {
  const rule: Access = collection.access?.delete ?? (() => false)
  return {
    ...collection,
    trash: true,
    access: { ...collection.access, delete: trashFirst(rule) },
  }
}

/**
 * Adds the publishing rules to a record type: its status, its computed
 * published status, its parents and checks, Payload's per-language drafts,
 * and the trash (section 8).
 */
export function withPublishing(
  collection: CollectionConfig,
  required: readonly string[],
  rules: Omit<PublishingRules, 'required'> = {},
): CollectionConfig {
  const full: PublishingRules = { status: true, drafts: true, ...rules, required }
  RULES.set(collection.slug, full)
  const versions =
    full.drafts && collection.versions !== false
      ? {
          ...(typeof collection.versions === 'object' ? collection.versions : {}),
          drafts: true,
        }
      : collection.versions
  return withTrash({
    ...collection,
    ...(versions === undefined ? {} : { versions }),
    fields: [
      ...collection.fields,
      ...(full.status === false ? [] : [statusField(full.defaultStatus ?? 'hold')]),
      ...computedFields(collection.slug, Boolean(full.checks)),
    ],
    hooks: {
      ...collection.hooks,
      beforeOperation: [
        ...(full.drafts ? [publishUnlessDraft(required.length === 0)] : []),
        ...(collection.hooks?.beforeOperation ?? []),
      ],
      beforeChange: [...(collection.hooks?.beforeChange ?? []), rememberPublishedIn],
      afterChange: [recomputeOnSave, ...(collection.hooks?.afterChange ?? [])],
    },
  })
}
