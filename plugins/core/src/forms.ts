import { createHash, randomBytes } from 'node:crypto'

import type { NewsletterProvider } from '@promisetracker/kernel'
import { createLog } from '@promisetracker/kernel'
import type { CollectionBeforeChangeHook, CollectionConfig, Payload, PayloadRequest } from 'payload'
import { APIError } from 'payload'

import { can, userCan } from './access'
import { ADMIN_GROUPS } from './adminGroups'
import { idOf } from './places'

/**
 * The public forms (sections 7.9, 12 and 13.9): submissions about a claim,
 * and newsletter sign-ups. Neither is public, and neither keeps version
 * history, so a sender's details are gone once removed.
 */

export const SUBMISSION_KINDS = ['evidence', 'correction', 'changed'] as const
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number]

export const SUBMISSION_STATUSES = ['new', 'accepted', 'rejected', 'spam'] as const

/** Files a sender may attach: photos and PDFs. */
export const SUBMISSION_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
] as const
/** The largest file a sender may attach. */
export const MAX_SUBMISSION_FILE = 20 * 1024 * 1024
/** How many files one submission may carry. */
export const MAX_SUBMISSION_FILES = 5
/** Rejected and spam submissions are removed after this many days (section 13.9). */
export const DISCARD_AFTER_DAYS = 180

const KIND_LABELS: Record<SubmissionKind, string> = {
  evidence: 'New evidence',
  correction: 'A correction',
  changed: 'Something has changed',
}

const readOnly = { readOnly: true } as const

/** Files sent with submissions. Only moderators open them, and they download, never render. */
export const SubmissionFiles: CollectionConfig = {
  slug: 'submission-files',
  labels: { singular: 'Submission file', plural: 'Submission files' },
  admin: { group: ADMIN_GROUPS.submissions, useAsTitle: 'filename', hidden: true },
  access: {
    read: can.moderateSubmissions,
    // The API stores them, as the system.
    create: () => false,
    update: () => false,
    delete: can.moderateSubmissions,
  },
  versions: false,
  upload: {
    mimeTypes: [...SUBMISSION_FILE_TYPES],
    pasteURL: false,
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Content-Security-Policy', "sandbox; default-src 'none'")
      headers.set('Content-Disposition', 'attachment')
      headers.set('X-Content-Type-Options', 'nosniff')
      return headers
    },
  },
  fields: [],
}

const startsWith = (data: Uint8Array, bytes: readonly number[], at = 0) =>
  bytes.every((byte, i) => data[at + i] === byte)
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

/**
 * A sent file's type from its first bytes. The declared type must agree
 * (section 13.5). SVG and anything else that could carry a script is not
 * among them.
 */
export function submissionFileType(file: { mimeType: string; data: Uint8Array }): string | null {
  const { data } = file
  const found = startsWith(data, [0xff, 0xd8, 0xff])
    ? 'image/jpeg'
    : startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ? 'image/png'
      : startsWith(data, ascii('RIFF')) && startsWith(data, ascii('WEBP'), 8)
        ? 'image/webp'
        : startsWith(data, ascii('ftyp'), 4) &&
            ['heic', 'heix', 'mif1', 'msf1'].some((brand) => startsWith(data, ascii(brand), 8))
          ? 'image/heic'
          : startsWith(data, ascii('%PDF-'))
            ? 'application/pdf'
            : null
  if (!found) return null
  const declared = file.mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  return declared === '' || declared === found ? found : null
}

/** The day, as a partial date a claim update takes. */
const today = (now = new Date()) => now.toISOString().slice(0, 10)

/**
 * Moderation (section 13.2). Setting a submission to accepted turns it into a
 * claim update, on hold, for an editor to rate and release. The sender is
 * credited only if they agreed. Whoever changes the status is recorded.
 */
const moderate: CollectionBeforeChangeHook = async ({ data, originalDoc, req, operation }) => {
  if (operation !== 'update') return data
  const status = data.status ?? originalDoc?.status
  if (status === originalDoc?.status) return data
  const next: Record<string, unknown> = { ...data }
  if (req.user) next.moderator = req.user.id
  if (status !== 'accepted' || idOf(originalDoc?.update)) return next
  if (req.user && !userCan(req.user, 'promoteSubmissions')) {
    throw new APIError('You cannot turn a submission into a claim update.', 403)
  }
  const claimId = idOf(originalDoc?.claim)
  const claim = claimId
    ? await req.payload
        .findByID({
          collection: 'claims',
          id: claimId,
          depth: 0,
          // The moderator's right was checked above.
          overrideAccess: true,
          req,
        })
        .catch(() => null)
    : null
  if (!claim) throw new APIError('The claim this submission is about is gone.', 400)
  const rating = Reflect.get(claim, 'currentRating')
  if (typeof rating !== 'string') {
    throw new APIError('The claim has no rating to start the update from.', 400)
  }
  const text = String(originalDoc?.text ?? '').trim()
  const kind = (originalDoc?.kind ?? 'evidence') as SubmissionKind
  const firstLine = text.split(/(?<=[.!?])\s|\n/)[0] ?? text
  const title = `${KIND_LABELS[kind]}: ${firstLine}`.slice(0, 140)
  const location = String(originalDoc?.location ?? '').trim()
  const name = String(originalDoc?.name ?? '').trim()
  const language = String(originalDoc?.language ?? '')
  const update = await req.payload.create({
    collection: 'claim-updates',
    ...(language ? { locale: language as never } : {}),
    data: {
      claim: claimId,
      date: today(),
      rating,
      title,
      narrative: location ? `${text}\n\nWhere: ${location}` : text,
      // Credited only with the sender's consent (section 7.9).
      ...(originalDoc?.consent && name ? { attribution: name } : {}),
      submission: originalDoc?.id,
      // An editor rates it and releases it.
      recordStatus: 'hold',
    } as never,
    depth: 0,
    // Moderators turn submissions into updates, which is how they rate (section 13.2).
    overrideAccess: true,
    req,
  })
  next.update = (update as { id: string }).id
  return next
}

/**
 * What a citizen sent about a claim (section 7.9): new evidence, a
 * correction, or a note that something has changed.
 */
export const Submissions: CollectionConfig = {
  slug: 'submissions',
  labels: { singular: 'Submission', plural: 'Submissions' },
  admin: {
    group: ADMIN_GROUPS.submissions,
    useAsTitle: 'reference',
    defaultColumns: ['reference', 'claim', 'kind', 'status', 'createdAt'],
    description:
      'What readers sent about claims. Set one to accepted to turn it into a claim update on hold.',
  },
  defaultSort: '-createdAt',
  access: {
    read: can.moderateSubmissions,
    // Only the public form makes them, through the API.
    create: () => false,
    update: can.moderateSubmissions,
    // Removing a sender's details on request (section 13.9).
    delete: can.moderateSubmissions,
  },
  // No history: a sender's details removed on request must not stay in an old version.
  versions: false,
  indexes: [{ fields: ['status', 'createdAt'] }],
  hooks: { beforeChange: [moderate] },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'claim',
          type: 'relationship',
          relationTo: 'claims',
          required: true,
          index: true,
          admin: readOnly,
        },
        {
          name: 'kind',
          type: 'select',
          required: true,
          options: SUBMISSION_KINDS.map((value) => ({ label: KIND_LABELS[value], value })),
          admin: readOnly,
        },
      ],
    },
    { name: 'text', label: 'What they saw', type: 'textarea', required: true, admin: readOnly },
    { name: 'location', label: 'Where', type: 'text', admin: readOnly },
    {
      name: 'evidenceUrl',
      label: 'Link',
      type: 'text',
      admin: { ...readOnly, description: 'Shown only. The server never opens it.' },
    },
    {
      name: 'files',
      type: 'upload',
      relationTo: 'submission-files',
      hasMany: true,
      admin: readOnly,
    },
    {
      type: 'collapsible',
      label: 'The sender',
      admin: {
        description:
          'Never shown on the site. Clear these when the sender asks, then save (section 13.9).',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'name', type: 'text' },
            { name: 'contact', type: 'text' },
          ],
        },
        {
          name: 'consent',
          label: 'Agreed to be credited by name',
          type: 'checkbox',
          defaultValue: false,
          admin: readOnly,
        },
      ],
    },
    {
      name: 'reference',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', ...readOnly, description: 'The sender was given this.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: SUBMISSION_STATUSES.map((value) => ({ label: value, value })),
      admin: { position: 'sidebar' },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { position: 'sidebar', description: 'For other moderators. Never shown.' },
    },
    {
      name: 'update',
      label: 'Claim update',
      type: 'relationship',
      relationTo: 'claim-updates',
      admin: { position: 'sidebar', ...readOnly, description: 'Made when it was accepted.' },
    },
    {
      name: 'moderator',
      type: 'relationship',
      relationTo: 'users',
      admin: { position: 'sidebar', ...readOnly },
    },
    { name: 'language', type: 'text', admin: { position: 'sidebar', ...readOnly } },
    {
      name: 'addressHash',
      label: 'Sender, scrambled',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        ...readOnly,
        description:
          'The same for every submission from one network address. It cannot be read back.',
      },
    },
  ],
}

/** A reference the sender can quote, such as `KE-2026-48213`. */
export const submissionReference = (code: string, now = new Date()): string =>
  `${code.toUpperCase()}-${now.getUTCFullYear()}-${String(10000 + Math.floor(Math.random() * 90000))}`

export type SubmissionFile = { filename: string; mimeType: string; data: Uint8Array }

export type NewSubmission = {
  claim: string
  country: string
  kind: SubmissionKind
  text: string
  location?: string
  evidenceUrl?: string
  name?: string
  contact?: string
  consent: boolean
  language: string
  addressHash: string
  files: readonly SubmissionFile[]
}

/** Stores a submission and its files, and returns the sender's reference. */
export async function createSubmission(payload: Payload, input: NewSubmission): Promise<string> {
  const files: string[] = []
  for (const file of input.files) {
    // The first bytes and the declared type must agree (section 13.5).
    const type = submissionFileType(file)
    if (!type) throw new APIError(`${file.filename} is not a photo or a PDF.`, 400, null, true)
    const stored = await payload.create({
      collection: 'submission-files' as never,
      data: {} as never,
      file: {
        data: Buffer.from(file.data),
        mimetype: type,
        name: file.filename,
        size: file.data.length,
      },
      // The public form's files, stored by the system once checked.
      overrideAccess: true,
    })
    files.push(String((stored as { id: unknown }).id))
  }
  const reference = submissionReference(input.country)
  await payload.create({
    collection: 'submissions' as never,
    data: {
      claim: input.claim,
      kind: input.kind,
      text: input.text,
      location: input.location ?? null,
      evidenceUrl: input.evidenceUrl ?? null,
      name: input.name ?? null,
      contact: input.contact ?? null,
      consent: input.consent,
      language: input.language,
      addressHash: input.addressHash,
      files,
      reference,
      status: 'new',
    } as never,
    // The public form's submission, checked by the API before it is stored.
    overrideAccess: true,
  })
  return reference
}

// Moderators

async function moderatorEmails(payload: Payload): Promise<string[]> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { roles: { in: ['moderator', 'editor', 'super-admin'] } },
    depth: 0,
    pagination: false,
    // Finds who to tell.
    overrideAccess: true,
  })
  return docs.map((user) => user.email).filter((email): email is string => Boolean(email))
}

/**
 * The daily digest (section 14): new submissions in the last day, to every
 * moderator. Also removes rejected and spam submissions older than 180 days
 * (section 13.9).
 */
export async function submissionDigest(
  payload: Payload,
  now = new Date(),
): Promise<{ sent: number; removed: number }> {
  const log = createLog(payload.logger, 'submissions')
  const cutoff = new Date(now.getTime() - DISCARD_AFTER_DAYS * 24 * 60 * 60_000).toISOString()
  const removed = await payload.delete({
    collection: 'submissions' as never,
    where: {
      and: [{ status: { in: ['rejected', 'spam'] } }, { updatedAt: { less_than: cutoff } }],
    },
    overrideAccess: true,
  })
  const since = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
  const { docs } = await payload.find({
    collection: 'submissions' as never,
    where: { and: [{ status: { equals: 'new' } }, { createdAt: { greater_than: since } }] },
    sort: 'createdAt',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  if (docs.length === 0) return { sent: 0, removed: removed.docs.length }
  const admin = `${payload.config.serverURL ?? ''}${payload.config.routes.admin}`
  const subject = `${docs.length} new ${docs.length === 1 ? 'submission' : 'submissions'} to moderate`
  const text = [
    `${docs.length} ${docs.length === 1 ? 'submission came' : 'submissions came'} in during the last day:`,
    '',
    ...docs.map((doc) => {
      const row = doc as { id: string; reference?: string; kind?: SubmissionKind; text?: string }
      const kind = row.kind ? KIND_LABELS[row.kind] : 'Submission'
      return `- ${row.reference ?? row.id}, ${kind}: ${String(row.text ?? '').slice(0, 120)}\n  ${admin}/collections/submissions/${row.id}`
    }),
  ].join('\n')
  const to = await moderatorEmails(payload)
  // Until an email provider is chosen (D40), this line is how the message is
  // seen. No addresses go in it (section 13.7).
  log.info('Emailed the moderators their daily digest', { subject, text, recipients: to.length })
  if (to.length > 0) await payload.sendEmail({ to, subject, text })
  return { sent: docs.length, removed: removed.docs.length }
}

export const submissionDigestTask = {
  slug: 'submissionDigest',
  label: 'Email moderators the new submissions',
  retries: 0,
  // Every day at 07:00 UTC. Payload's cron has a seconds field first.
  schedule: [{ cron: '0 0 7 * * *', queue: 'default' }],
  handler: async ({ req }: { req: PayloadRequest }) => {
    await submissionDigest(req.payload)
    return { output: {} }
  },
}

/**
 * The dashboard's figures (section 16.4): submissions in the last 30 days,
 * those waiting, and those that changed the record, which is an accepted
 * one whose update an editor released.
 */
export async function submissionCounts(
  payload: Payload,
  now = new Date(),
): Promise<{ received: number; waiting: number; changed: number }> {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString()
  const count = async (where: object) =>
    (
      await payload.count({
        collection: 'submissions' as never,
        where: where as never,
        overrideAccess: true,
      })
    ).totalDocs
  const [received, waiting, accepted] = await Promise.all([
    count({ createdAt: { greater_than: since } }),
    count({ status: { equals: 'new' } }),
    payload.find({
      collection: 'submissions' as never,
      where: {
        and: [{ status: { equals: 'accepted' } }, { createdAt: { greater_than: since } }],
      },
      select: { update: true } as never,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    }),
  ])
  const updates = accepted.docs
    .map((doc) => idOf((doc as { update?: unknown }).update))
    .filter((id): id is string => Boolean(id))
  const changed = updates.length
    ? (
        await payload.count({
          collection: 'claim-updates',
          where: { and: [{ id: { in: updates } }, { recordStatus: { equals: 'ready' } }] },
          overrideAccess: true,
        })
      ).totalDocs
    : 0
  return { received, waiting, changed }
}

// Newsletter

/** People who signed up to the newsletter (section 7.9). Used by the `local` adapter only. */
export const NewsletterSignups: CollectionConfig = {
  slug: 'newsletter-signups',
  labels: { singular: 'Newsletter sign-up', plural: 'Newsletter sign-ups' },
  admin: {
    group: ADMIN_GROUPS.submissions,
    useAsTitle: 'email',
    defaultColumns: ['email', 'language', 'confirmed', 'confirmedAt'],
    description: 'Nobody is subscribed until they confirm by email.',
  },
  access: {
    read: can.manageUsers,
    create: () => false,
    update: () => false,
    // Removing someone on request (section 13.9).
    delete: can.manageUsers,
  },
  versions: false,
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true, admin: readOnly },
    { name: 'language', type: 'text', admin: readOnly },
    { name: 'confirmed', type: 'checkbox', defaultValue: false, index: true, admin: readOnly },
    { name: 'confirmedAt', type: 'date', admin: readOnly },
    // The confirmation link's token, hashed. Only the system reads it.
    {
      name: 'tokenHash',
      type: 'text',
      index: true,
      admin: { hidden: true },
      access: { read: () => false, create: () => false, update: () => false },
    },
    {
      name: 'tokenExpiresAt',
      type: 'date',
      admin: { hidden: true },
      access: { read: () => false, create: () => false, update: () => false },
    },
  ],
}

/** How long a confirmation link works. */
export const CONFIRM_TTL_MS = 7 * 24 * 60 * 60_000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

const normalEmail = (email: string) => email.trim().toLowerCase()

/** The confirmation email's words, in English and French. */
const CONFIRM_TEXT = {
  en: {
    subject: 'Confirm your PromiseTracker sign-up',
    body: (link: string) =>
      `Someone, hopefully you, asked to receive PromiseTracker's newsletter at this address.\n\nTo confirm, open this link:\n${link}\n\nIf it was not you, ignore this email and nothing will be sent.`,
  },
  fr: {
    subject: 'Confirmez votre inscription à PromiseTracker',
    body: (link: string) =>
      `Quelqu’un, sans doute vous, a demandé à recevoir la lettre de PromiseTracker à cette adresse.\n\nPour confirmer, ouvrez ce lien :\n${link}\n\nSi ce n’est pas vous, ignorez cet e-mail : rien ne vous sera envoyé.`,
  },
} as const

/**
 * The `local` newsletter (section 6.5): sign-ups are stored here, and each
 * gets a confirmation email. Nothing is subscribed until the link in it is
 * opened. Someone already subscribed gets no second email, and the form says
 * the same either way, so it does not tell who is subscribed.
 */
export const localNewsletter: NewsletterProvider = {
  id: 'local',
  health: async () => ({ healthy: true }),
  subscribe: async (rawEmail, locale, ctx) => {
    const { payload } = ctx
    const email = normalEmail(rawEmail)
    const { docs } = await payload.find({
      collection: 'newsletter-signups' as never,
      where: { email: { equals: email } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const existing = docs[0] as { id: string; confirmed?: boolean } | undefined
    if (existing?.confirmed) return
    const token = randomBytes(24).toString('base64url')
    const data = {
      email,
      language: locale,
      tokenHash: hashToken(token),
      tokenExpiresAt: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
    }
    if (existing) {
      await payload.update({
        collection: 'newsletter-signups' as never,
        id: existing.id,
        data: data as never,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'newsletter-signups' as never,
        data: { ...data, confirmed: false } as never,
        overrideAccess: true,
      })
    }
    const words = locale === 'fr' ? CONFIRM_TEXT.fr : CONFIRM_TEXT.en
    const link = `${payload.config.serverURL ?? ''}/${locale}/newsletter?token=${token}`
    const text = words.body(link)
    // Until an email provider is chosen (D40), this line is how the message is
    // seen. The address stays out of it (section 13.7).
    createLog(payload.logger, 'newsletter').info('Emailed a newsletter confirmation', {
      subject: words.subject,
      text,
    })
    await sendQuietly(payload, () => payload.sendEmail({ to: email, subject: words.subject, text }))
  },
  unsubscribe: async (rawEmail, ctx) => {
    await ctx.payload.delete({
      collection: 'newsletter-signups' as never,
      where: { email: { equals: normalEmail(rawEmail) } },
      overrideAccess: true,
    })
  },
}

/** Sends an email without letting a failed send fail the sign-up. */
async function sendQuietly(payload: Payload, send: () => Promise<unknown>) {
  try {
    await send()
  } catch (error) {
    payload.logger.error({ err: error, msg: 'Could not send a newsletter confirmation' })
  }
}

/** Confirms a sign-up from its email's link. False when the link is wrong or too old. */
export async function confirmSignup(payload: Payload, token: string): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return false
  const { docs } = await payload.find({
    collection: 'newsletter-signups' as never,
    where: { tokenHash: { equals: hashToken(token) } },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  const found = docs[0] as { id: string; tokenExpiresAt?: string | null } | undefined
  if (!found) return false
  if (!found.tokenExpiresAt || new Date(found.tokenExpiresAt).getTime() < Date.now()) return false
  await payload.update({
    collection: 'newsletter-signups' as never,
    id: found.id,
    data: {
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      tokenHash: null,
      tokenExpiresAt: null,
    } as never,
    overrideAccess: true,
  })
  return true
}
