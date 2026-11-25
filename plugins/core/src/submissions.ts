import { createHash, randomBytes } from 'node:crypto'

import type { NewsletterProvider } from '@promisetracker/kernel'
import type {
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionConfig,
  Payload,
  PayloadRequest,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { can } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import type { SubmissionFileType } from './documents/fileType'

/**
 * Citizen submissions and newsletter sign-ups (sections 7.9 and 13.9). Both
 * come in through the public API only, after the captcha. Neither is ever
 * shown on the public site: a submission reaches it only as a claim update an
 * editor publishes, credited to the sender only with their consent.
 */

export const SUBMISSIONS = 'submissions' as const
export const SUBMISSION_FILES = 'submission-files' as const
export const NEWSLETTER_SIGNUPS = 'newsletter-signups' as const

export const SUBMISSION_KINDS = ['evidence', 'correction', 'changed'] as const
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]

export const SUBMISSION_STATUSES = ['new', 'accepted', 'rejected', 'spam'] as const

/** Waiting for a moderator. */
export const WAITING_SUBMISSIONS: Where = { status: { equals: 'new' } }

/** Limits on what one submission carries (section 13.5). */
export const SUBMISSION_LIMITS = {
  text: 5000,
  short: 300,
  files: 3,
  fileBytes: 10 * 1024 * 1024,
} as const

const KIND_LABELS: Record<SubmissionKind, string> = {
  evidence: 'New evidence',
  correction: 'A correction',
  changed: 'Something has changed',
}

const idOf = (value: unknown): string | null => {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id
  }
  return null
}

/** Files sent with submissions. Only moderators can open them. */
export const SubmissionFiles: CollectionConfig = {
  slug: SUBMISSION_FILES,
  labels: { singular: 'Submission file', plural: 'Submission files' },
  // Personal data: no history, so a deletion deletes (section 13.9).
  versions: false,
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'filename',
    hidden: true,
  },
  access: {
    read: can.moderateSubmissions,
    // Created by the public API only, after its checks.
    create: () => false,
    update: () => false,
    delete: can.moderateSubmissions,
  },
  upload: {
    pasteURL: false,
    // A stored file never runs in the admin's origin: it downloads, sandboxed.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Content-Security-Policy', "sandbox; default-src 'none'")
      headers.set('Content-Disposition', 'attachment')
      headers.set('X-Content-Type-Options', 'nosniff')
      return headers
    },
  },
  fields: [],
}

/** A short title for the claim update a submission becomes. */
const titleFrom = (text: string) => {
  const line = text.trim().split('\n')[0] ?? ''
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line
}

/**
 * When a moderator accepts a submission, it becomes a draft claim update on
 * its claim, for an editor to finish and publish. The sender is credited only
 * when they agreed and gave a name. Whoever decides is recorded.
 */
const moderate: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  if (operation !== 'update') return data
  const status = data.status ?? originalDoc?.status
  if (status === originalDoc?.status) return data
  const decided = { ...data, ...(req.user ? { moderator: req.user.id } : {}) }
  if (status !== 'accepted' || idOf(originalDoc?.claimUpdate)) return decided
  const claim = idOf(originalDoc?.claim)
  if (!claim) throw new APIError('This submission has no claim to update.', 400)
  const { docs } = await req.payload.find({
    collection: 'claims',
    where: { id: { equals: claim } },
    depth: 0,
    limit: 1,
    trash: true,
    // Reads the claim's rating for the draft update.
    overrideAccess: true,
    req,
  })
  const text = String(data.text ?? originalDoc?.text ?? '')
  const name = String(data.name ?? originalDoc?.name ?? '').trim()
  const consent = Boolean(data.consent ?? originalDoc?.consent)
  const kind = (data.kind ?? originalDoc?.kind) as SubmissionKind
  const locale = String(originalDoc?.locale ?? 'en')
  const update = await req.payload.create({
    collection: 'claim-updates',
    draft: true,
    locale: locale as never,
    data: {
      _status: 'draft',
      claim,
      date: new Date().toISOString().slice(0, 10),
      rating: String(docs[0]?.currentRating ?? ''),
      title: titleFrom(text) || KIND_LABELS[kind],
      narrative: text,
      ...(consent && name ? { attribution: name } : {}),
    } as never,
    // Moderators may turn a submission into an update (section 13.2), which
    // the update's own rule, rating a claim, would refuse. It starts as a
    // draft, so nothing is public until an editor publishes it.
    overrideAccess: true,
    req,
  })
  return { ...decided, claimUpdate: update.id }
}

/** A deleted submission takes its files with it, so no upload outlives it (section 13.9). */
const deleteFiles: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const list: unknown = Reflect.get(doc, 'files')
  const files = Array.isArray(list) ? list.map(idOf).filter((id): id is string => id !== null) : []
  if (files.length === 0) return
  await req.payload.delete({
    collection: SUBMISSION_FILES,
    where: { id: { in: files } },
    // Whoever may delete a submission may delete its files.
    overrideAccess: true,
    req,
  })
}

/** The moderation queue (section 13.2). Created by the public API only. */
export const Submissions: CollectionConfig = {
  slug: SUBMISSIONS,
  labels: { singular: 'Submission', plural: 'Submissions' },
  // Personal data: no history, so clearing a sender's details erases them (section 13.9).
  versions: false,
  admin: {
    group: ADMIN_GROUPS.claims,
    useAsTitle: 'text',
    defaultColumns: ['text', 'kind', 'claim', 'status', 'createdAt'],
    description:
      'Sent in by readers. Accepting one makes a draft claim update for an editor to publish. Contact details are never shown publicly: clear them when the sender asks.',
  },
  defaultSort: '-createdAt',
  access: {
    read: can.moderateSubmissions,
    // Only the public API creates them, after the captcha.
    create: () => false,
    update: can.moderateSubmissions,
    delete: can.moderateSubmissions,
  },
  hooks: { beforeChange: [moderate], afterDelete: [deleteFiles] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'status',
          type: 'select',
          required: true,
          index: true,
          defaultValue: 'new',
          options: SUBMISSION_STATUSES.map((value) => ({ label: value, value })),
        },
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: SUBMISSION_KINDS.map((value) => ({ label: KIND_LABELS[value], value })),
          access: { update: () => false },
        },
      ],
    },
    {
      name: 'claim',
      type: 'relationship',
      relationTo: 'claims',
      required: true,
      index: true,
      access: { update: () => false },
    },
    { name: 'text', type: 'textarea', required: true, access: { update: () => false } },
    { name: 'location', type: 'text', access: { update: () => false } },
    {
      name: 'files',
      type: 'upload',
      relationTo: SUBMISSION_FILES,
      hasMany: true,
      access: { update: () => false },
    },
    {
      name: 'link',
      type: 'text',
      admin: { description: 'As the sender typed it. The server never opens it.' },
      access: { update: () => false },
    },
    {
      type: 'collapsible',
      label: 'Sender',
      fields: [
        {
          name: 'name',
          type: 'text',
          admin: { description: 'Optional. Clear it when the sender asks.' },
        },
        {
          name: 'contact',
          type: 'text',
          admin: { description: 'Optional. Never published. Clear it when the sender asks.' },
        },
        {
          name: 'consent',
          type: 'checkbox',
          admin: { description: 'The sender agreed to be credited by name.' },
        },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'For moderators. Never shown publicly.' },
    },
    {
      name: 'moderator',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'claimUpdate',
      type: 'relationship',
      relationTo: 'claim-updates',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'The draft update made when this was accepted.',
      },
    },
    {
      name: 'locale',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true, description: 'The language it was sent in.' },
      access: { update: () => false },
    },
    {
      name: 'sender',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'A scrambled form of the network address, to spot repeated abuse.',
      },
      access: { update: () => false },
    },
  ],
}

export type IncomingFile = {
  filename: string
  type: SubmissionFileType
  data: Uint8Array
}

export type IncomingSubmission = {
  claim: string
  kind: SubmissionKind
  text: string
  location?: string
  link?: string
  name?: string
  contact?: string
  consent: boolean
  locale: string
  sender: string
  files: IncomingFile[]
}

/** Stores a submission and its files. Returns its id. */
export async function receiveSubmission(
  payload: Payload,
  submission: IncomingSubmission,
): Promise<string> {
  const files: string[] = []
  for (const file of submission.files) {
    const stored = await payload.create({
      collection: SUBMISSION_FILES,
      data: {},
      file: {
        name: file.filename,
        data: Buffer.from(file.data),
        mimetype: file.type,
        size: file.data.byteLength,
      },
      // The public API stores a file only after checking it.
      overrideAccess: true,
    })
    files.push(String(stored.id))
  }
  const { files: _files, ...rest } = submission
  const doc = await payload.create({
    collection: SUBMISSIONS,
    data: { ...rest, files, status: 'new' } as never,
    // Guests cannot create submissions through REST; the public API checked this one.
    overrideAccess: true,
  })
  return String(doc.id)
}

/** The emails of everyone who moderates. */
async function moderatorEmails(payload: Payload): Promise<string[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { roles: { in: ['moderator'] } },
    depth: 0,
    pagination: false,
    // Finds who to tell.
    overrideAccess: true,
  })
  return docs.map((user) => user.email).filter((email): email is string => Boolean(email))
}

/**
 * The daily digest for moderators: how many submissions arrived in the last
 * day, and how many wait. Nothing is sent on a day with none.
 */
export async function sendSubmissionsDigest(payload: Payload, now = new Date()): Promise<boolean> {
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
  const [fresh, waiting] = await Promise.all([
    payload.count({
      collection: SUBMISSIONS,
      where: { and: [WAITING_SUBMISSIONS, { createdAt: { greater_than_equal: since } }] },
      // The digest counts as the system.
      overrideAccess: true,
    }),
    payload.count({
      collection: SUBMISSIONS,
      where: WAITING_SUBMISSIONS,
      overrideAccess: true,
    }),
  ])
  if (fresh.totalDocs === 0) return false
  const to = await moderatorEmails(payload)
  if (to.length === 0) return false
  const admin = `${payload.config.serverURL ?? ''}${payload.config.routes.admin}`
  const plural = (n: number) => (n === 1 ? 'submission' : 'submissions')
  await payload.sendEmail({
    to,
    subject: `${fresh.totalDocs} new ${plural(fresh.totalDocs)} to moderate`,
    text: [
      `${fresh.totalDocs} ${plural(fresh.totalDocs)} came in over the last day. ${waiting.totalDocs} ${waiting.totalDocs === 1 ? 'is' : 'are'} waiting in all.`,
      `Open the queue: ${admin}/collections/${SUBMISSIONS}?where[status][equals]=new`,
    ].join('\n\n'),
  })
  return true
}

/** Rejected and spam submissions are kept this long (section 13.9). */
export const DISCARDED_RETENTION_DAYS = 180

/** Deletes rejected and spam submissions past their retention, with their files. */
export async function deleteOldSubmissions(payload: Payload, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - DISCARDED_RETENTION_DAYS * 24 * 60 * 60_000)
  const { docs } = await payload.delete({
    collection: SUBMISSIONS,
    where: {
      and: [
        { status: { in: ['rejected', 'spam'] } },
        { updatedAt: { less_than: before.toISOString() } },
      ],
    },
    depth: 0,
    // Retention runs as the system.
    overrideAccess: true,
  })
  return docs.length
}

export const submissionsDigestTask = {
  slug: 'submissionsDigest',
  inputSchema: [],
  retries: 1,
  schedule: [{ cron: '0 6 * * *', queue: 'default' }],
  handler: async ({ req }: { req: PayloadRequest }) => {
    await deleteOldSubmissions(req.payload)
    await sendSubmissionsDigest(req.payload)
    return { output: {} }
  },
}

// Newsletter

/** How long a confirmation link works. */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000

/** How long before a sign-up's confirmation email can be sent again. */
export const RESEND_AFTER_MS = 60 * 60_000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/** Sign-ups for the `local` newsletter adapter. Personal data, for super-admins only. */
export const NewsletterSignups: CollectionConfig = {
  slug: NEWSLETTER_SIGNUPS,
  labels: { singular: 'Newsletter sign-up', plural: 'Newsletter sign-ups' },
  // Personal data: no history, so a deletion deletes (section 13.9).
  versions: false,
  admin: {
    group: ADMIN_GROUPS.administration,
    useAsTitle: 'email',
    defaultColumns: ['email', 'locale', 'confirmed', 'confirmedAt'],
    description: 'Nobody is subscribed until they confirm from the email.',
  },
  access: {
    read: can.manageUsers,
    create: () => false,
    update: () => false,
    delete: can.manageUsers,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true },
    { name: 'locale', type: 'text', required: true },
    { name: 'confirmed', type: 'checkbox', defaultValue: false, index: true },
    { name: 'confirmedAt', type: 'date' },
    { name: 'tokenHash', type: 'text', index: true, hidden: true },
    { name: 'tokenExpires', type: 'date', hidden: true },
  ],
}

const confirmLink = (payload: Payload, locale: string, token: string) =>
  `${payload.config.serverURL ?? ''}/${locale}/newsletter/confirm?token=${token}`

/**
 * The `local` newsletter adapter (section 6.5): stores the sign-up and sends a
 * confirmation email through Payload's email adapter. An address already
 * confirmed gets nothing, and the caller is answered the same either way.
 */
export const localNewsletter: NewsletterProvider = {
  id: 'local',
  health: async () => ({ healthy: true }),
  async subscribe(email, locale, { payload }) {
    const address = email.trim().toLowerCase()
    const { docs } = await payload.find({
      collection: NEWSLETTER_SIGNUPS,
      where: { email: { equals: address } },
      depth: 0,
      limit: 1,
      // The token's expiry tells when the last email went.
      showHiddenFields: true,
      // The adapter stores sign-ups for the public API.
      overrideAccess: true,
    })
    const existing = docs[0] as
      | { id: string; confirmed?: boolean | null; tokenExpires?: string | null }
      | undefined
    if (existing?.confirmed) return
    // One email an hour per address at most, so the form cannot flood an
    // inbox or keep replacing a link the owner is about to open.
    const issued = existing?.tokenExpires
      ? new Date(existing.tokenExpires).getTime() - CONFIRM_TTL_MS
      : 0
    if (Date.now() - issued < RESEND_AFTER_MS) return
    const token = randomBytes(24).toString('base64url')
    const data = {
      email: address,
      locale,
      confirmed: false,
      tokenHash: hashToken(token),
      tokenExpires: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
    }
    if (existing) {
      await payload.update({
        collection: NEWSLETTER_SIGNUPS,
        id: existing.id,
        data: data as never,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: NEWSLETTER_SIGNUPS,
        data: data as never,
        overrideAccess: true,
      })
    }
    await payload.sendEmail({
      to: address,
      subject: 'Confirm your PromiseTracker newsletter sign-up',
      text: [
        'Someone, we hope you, asked to get the PromiseTracker newsletter at this address.',
        `To confirm, open this link within 7 days:\n${confirmLink(payload, locale, token)}`,
        'If it was not you, ignore this email and nothing will be sent again.',
      ].join('\n\n'),
    })
  },
  async unsubscribe(email, { payload }) {
    await payload.delete({
      collection: NEWSLETTER_SIGNUPS,
      where: { email: { equals: email.trim().toLowerCase() } },
      // Removes the sign-up for whoever asks to leave.
      overrideAccess: true,
    })
  },
}

/** Confirms the sign-up a link's token belongs to. False when unknown or expired. */
export async function confirmSignup(payload: Payload, token: string): Promise<boolean> {
  if (!token) return false
  const { docs } = await payload.find({
    collection: NEWSLETTER_SIGNUPS,
    where: {
      and: [
        { tokenHash: { equals: hashToken(token) } },
        { tokenExpires: { greater_than: new Date().toISOString() } },
      ],
    },
    depth: 0,
    limit: 1,
    // Confirms for the public API.
    overrideAccess: true,
  })
  const signup = docs[0] as { id: string } | undefined
  if (!signup) return false
  await payload.update({
    collection: NEWSLETTER_SIGNUPS,
    id: signup.id,
    data: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      tokenHash: null,
      tokenExpires: null,
    } as never,
    overrideAccess: true,
  })
  return true
}
