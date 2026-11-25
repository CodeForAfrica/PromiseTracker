import { CaptchaChallenge, SubmissionReceipt } from '@promisetracker/contract'
import type { SubmissionKind } from '@promisetracker/plugin-core'
import {
  confirmSignup,
  receiveSubmission,
  SUBMISSION_KINDS,
  SUBMISSION_LIMITS,
  scrambleAddress,
  submissionFileType,
  TRAP_FIELD,
} from '@promisetracker/plugin-core'
import type { Payload } from 'payload'

import { kernel, ownerOf } from '../kernel'

/**
 * The public forms (section 12.1): a citizen submission and a newsletter
 * sign-up, each behind the captcha (D32), and the captcha's challenge. Like
 * the reads, the HTTP route and the SDK's local transport both call these.
 */

export type FormResult = { status: 200 | 201 | 400 | 403 | 404 | 413 | 429; body: unknown }

/** What the form sent: text fields and files. */
export type FormInput = {
  text(name: string): string
  files(name: string): File[]
}

/** Who sent it, for the captcha's rate limit. Never stored as given. */
export type Sender = { ip?: string; userAgent?: string }

const bad = (error: string): FormResult => ({ status: 400, body: { error } })
const refused = (): FormResult => ({
  status: 403,
  body: { error: 'captcha' },
})

const inUse = (locale: string) => kernel.locales.some((l) => l.code === locale)

/** A new proof-of-work challenge for a form. Never cached. */
export async function captchaChallenge(payload: Payload) {
  const captcha = kernel.adapters.captcha
  const challenge = await captcha.challenge(await kernel.context(payload, ownerOf(captcha)))
  return CaptchaChallenge.parse(challenge)
}

async function passes(payload: Payload, input: FormInput, sender: Sender): Promise<boolean> {
  const captcha = kernel.adapters.captcha
  return captcha.verify(
    input.text('captcha'),
    {
      ...(sender.ip ? { ip: sender.ip } : {}),
      ...(sender.userAgent ? { userAgent: sender.userAgent } : {}),
      trap: input.text(TRAP_FIELD),
    },
    await kernel.context(payload, ownerOf(captcha)),
  )
}

const isKind = (value: string): value is SubmissionKind =>
  SUBMISSION_KINDS.some((kind) => kind === value)

/** A guest's view of the claim: only one published in this language can take a submission. */
async function publishedClaim(
  payload: Payload,
  code: string,
  slug: string,
  locale: string,
): Promise<string | null> {
  const countries = await payload.find({
    collection: 'countries',
    where: { code: { equals: code } },
    depth: 0,
    limit: 1,
    joins: false,
    overrideAccess: false,
  })
  const country = countries.docs[0]
  if (!country) return null
  const { docs } = await payload.find({
    collection: 'claims',
    where: { and: [{ country: { equals: country.id } }, { slug: { equals: slug } }] },
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const claim = docs[0]
  return claim && (claim.publishedIn ?? []).includes(locale as never) ? claim.id : null
}

const tooLong = (value: string, limit: number) => value.length > limit

async function submission(payload: Payload, input: FormInput, sender: Sender) {
  const locale = input.text('locale')
  if (!inUse(locale)) return bad('locale')
  const kind = input.text('kind')
  if (!isKind(kind)) return bad('kind')
  const text = input.text('text')
  if (!text) return bad('text')
  const fields = {
    location: input.text('location'),
    link: input.text('link'),
    name: input.text('name'),
    contact: input.text('contact'),
  }
  if (tooLong(text, SUBMISSION_LIMITS.text)) return bad('text')
  for (const [name, value] of Object.entries(fields)) {
    if (tooLong(value, SUBMISSION_LIMITS.short)) return bad(name)
  }
  if (fields.link && !/^https?:\/\/\S+$/.test(fields.link)) return bad('link')
  const uploads = input.files('files').filter((file) => file.size > 0)
  if (uploads.length > SUBMISSION_LIMITS.files) return bad('files')
  if (uploads.some((file) => file.size > SUBMISSION_LIMITS.fileBytes)) {
    return { status: 413, body: { error: 'files' } } satisfies FormResult
  }
  // The captcha is checked before anything is read from the database or stored.
  if (!(await passes(payload, input, sender))) return refused()
  const claim = await publishedClaim(payload, input.text('country'), input.text('claim'), locale)
  if (!claim) return { status: 404, body: { error: 'not-found' } } satisfies FormResult
  const files = []
  for (const file of uploads) {
    const data = new Uint8Array(await file.arrayBuffer())
    const type = submissionFileType({ filename: file.name, declaredType: file.type, data })
    if (!type) return bad('files')
    files.push({ filename: file.name, type, data })
  }
  const id = await receiveSubmission(payload, {
    claim,
    kind,
    text,
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value)),
    consent: input.text('consent') === 'true' || input.text('consent') === 'on',
    locale,
    sender: scrambleAddress(sender.ip ?? 'unknown', payload.secret),
    files,
  })
  const receipt = SubmissionReceipt.parse({
    reference: `${input.text('country').toUpperCase()}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
  })
  return { status: 201, body: receipt } satisfies FormResult
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function subscription(payload: Payload, input: FormInput, sender: Sender) {
  const locale = input.text('locale')
  if (!inUse(locale)) return bad('locale')
  const email = input.text('email')
  if (!EMAIL.test(email) || email.length > 254) return bad('email')
  if (!(await passes(payload, input, sender))) return refused()
  const newsletter = kernel.adapters.newsletter
  await newsletter.subscribe(email, locale, await kernel.context(payload, ownerOf(newsletter)))
  // The same answer whether or not the address was already signed up.
  return { status: 201, body: { ok: true } } satisfies FormResult
}

async function confirmation(payload: Payload, input: FormInput) {
  const confirmed = await confirmSignup(payload, input.text('token'))
  return confirmed
    ? ({ status: 200, body: { ok: true } } satisfies FormResult)
    : ({ status: 404, body: { error: 'not-found' } } satisfies FormResult)
}

/** The forms, by path. `undefined` when no form has the path. */
export async function handleForm(
  payload: Payload,
  path: string,
  input: FormInput,
  sender: Sender = {},
): Promise<FormResult | undefined> {
  switch (path) {
    case '/submissions':
      return submission(payload, input, sender)
    case '/subscriptions':
      return subscription(payload, input, sender)
    case '/subscriptions/confirm':
      return confirmation(payload, input)
    default:
      return undefined
  }
}

/** Form input from plain values, for JSON bodies and the local transport. */
export function inputOf(values: Readonly<Record<string, unknown>>, files: File[] = []): FormInput {
  return {
    text: (name) => {
      const value = values[name]
      return typeof value === 'string'
        ? value.trim()
        : typeof value === 'boolean'
          ? String(value)
          : ''
    },
    files: (name) => (name === 'files' ? files : []),
  }
}

/** Form input from a multipart or URL-encoded body. */
export function inputOfFormData(form: FormData): FormInput {
  return {
    text: (name) => {
      const value = form.get(name)
      return typeof value === 'string' ? value.trim() : ''
    },
    files: (name) => form.getAll(name).filter((value): value is File => typeof value !== 'string'),
  }
}
