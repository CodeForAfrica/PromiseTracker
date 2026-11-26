import {
  ConfirmForm,
  ConfirmReceipt,
  SubmissionForm,
  SubmissionReceipt,
  SubscriptionForm,
} from '@promisetracker/contract'
import type { SubmissionFile } from '@promisetracker/plugin-core'
import {
  clientAddress,
  confirmSignup,
  createRateLimiter,
  createSubmission,
  isCountryCode,
  MAX_SUBMISSION_FILE,
  MAX_SUBMISSION_FILES,
  publishedInLocale,
  scrambleAddress,
} from '@promisetracker/plugin-core'
import type { Payload } from 'payload'

import { kernel, ownerOf } from '../kernel'
import { inUse } from './v1'

/**
 * The two public forms (sections 12 and 13.5): `POST /api/v1/submissions` and
 * `POST /api/v1/subscriptions`, with the newsletter's confirmation. Each
 * needs a captcha answer, an empty trap field, and stays under a rate limit
 * per scrambled network address. Nothing a sender types is fetched.
 */

const NO_STORE = 'no-store'

const answer = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': NO_STORE } })

const fail = (status: number, error: string) => answer({ error }, status)

/** Per sender, a few forms in ten minutes is plenty for a person and too few for a flood. */
const WINDOW_MS = 10 * 60_000
const limits = {
  submissions: createRateLimiter({ limit: 5, windowMs: WINDOW_MS }),
  subscriptions: createRateLimiter({ limit: 5, windowMs: WINDOW_MS }),
  confirm: createRateLimiter({ limit: 20, windowMs: WINDOW_MS }),
}

/** The most a submission may weigh: its files and a little for the fields. */
const MAX_BODY = MAX_SUBMISSION_FILES * MAX_SUBMISSION_FILE + 1024 * 1024

type Limited = keyof typeof limits

async function captchaPasses(payload: Payload, token: string, request: Request): Promise<boolean> {
  const captcha = kernel.adapters.captcha
  return captcha.verify(
    token,
    {
      ip: clientAddress(request.headers),
      ...(request.headers.get('user-agent')
        ? { userAgent: request.headers.get('user-agent') ?? '' }
        : {}),
    },
    await kernel.context(payload, ownerOf(captcha)),
  )
}

/** The first problem with a form, in words for the reader's developer. */
const problemOf = (error: { issues: readonly { path: readonly PropertyKey[] }[] }): string => {
  const [issue] = error.issues
  const field = String(issue?.path[0] ?? 'form')
  return `The ${field} field is missing or not of the right form.`
}

/** A bot filled in the hidden field. It is told all went well, and nothing is kept. */
const trapped = (fields: { website?: string | undefined }): boolean => Boolean(fields.website)

async function submissions(payload: Payload, request: Request, address: string) {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (length > MAX_BODY) return fail(413, 'The files are too large.')
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return fail(400, 'Send the submission as a form.')
  }
  const fields: Record<string, string> = {}
  const files: File[] = []
  for (const [key, value] of form.entries()) {
    if (key === 'files' && typeof value !== 'string') files.push(value)
    else if (typeof value === 'string') fields[key] = value
  }
  const parsed = SubmissionForm.safeParse(fields)
  if (!parsed.success) return fail(400, problemOf(parsed.error))
  const input = parsed.data
  if (!inUse(input.locale)) return fail(400, 'The locale is not one the site runs in.')
  if (trapped(input)) {
    return answer(SubmissionReceipt.parse({ reference: 'received', sent: today() }))
  }
  if (!(await captchaPasses(payload, input.captcha, request))) {
    return fail(403, 'The captcha answer is wrong or was already used. Reload the page.')
  }
  if (files.length > MAX_SUBMISSION_FILES) {
    return fail(400, `Send at most ${MAX_SUBMISSION_FILES} files.`)
  }
  if (files.some((f) => f.size > MAX_SUBMISSION_FILE)) {
    return fail(413, 'A file is larger than 20MB.')
  }
  if (!isCountryCode(input.country)) return fail(404, 'There is no such claim.')
  // Only a claim published in the reader's language can be written about.
  const { docs } = await payload.find({
    collection: 'claims',
    where: {
      and: [
        { 'country.code': { equals: input.country } },
        { slug: { equals: input.claim } },
        publishedInLocale(input.locale),
      ],
    },
    select: { slug: true },
    depth: 0,
    limit: 1,
    overrideAccess: false,
  })
  const [claim] = docs
  if (!claim) return fail(404, 'There is no such claim.')
  const attached: SubmissionFile[] = []
  for (const file of files) {
    attached.push({
      filename: file.name || 'file',
      mimeType: file.type,
      data: new Uint8Array(await file.arrayBuffer()),
    })
  }
  try {
    const reference = await createSubmission(payload, {
      claim: claim.id,
      country: input.country,
      kind: input.kind,
      text: input.text,
      ...(input.location ? { location: input.location } : {}),
      ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
      ...(input.name ? { name: input.name } : {}),
      ...(input.contact ? { contact: input.contact } : {}),
      consent: input.consent === 'true',
      language: input.locale,
      addressHash: address,
      files: attached,
    })
    return answer(SubmissionReceipt.parse({ reference, sent: today() }))
  } catch (error) {
    // A file that fails the checks says why. Anything else is ours.
    const status = Reflect.get(Object(error), 'status')
    if (status === 400) return fail(400, error instanceof Error ? error.message : 'Bad file.')
    throw error
  }
}

async function json(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function subscriptions(payload: Payload, request: Request) {
  const parsed = SubscriptionForm.safeParse(await json(request))
  if (!parsed.success) return fail(400, problemOf(parsed.error))
  const input = parsed.data
  if (!inUse(input.locale)) return fail(400, 'The locale is not one the site runs in.')
  if (trapped(input)) return answer({ ok: true })
  if (!(await captchaPasses(payload, input.captcha, request))) {
    return fail(403, 'The captcha answer is wrong or was already used. Reload the page.')
  }
  const newsletter = kernel.adapters.newsletter
  await newsletter.subscribe(
    input.email,
    input.locale,
    await kernel.context(payload, ownerOf(newsletter)),
  )
  // The same answer whether or not the address was already subscribed.
  return answer({ ok: true })
}

async function confirm(payload: Payload, request: Request) {
  const parsed = ConfirmForm.safeParse(await json(request))
  if (!parsed.success) return fail(400, problemOf(parsed.error))
  // Another newsletter adapter confirms in its own service.
  if (kernel.adapters.newsletter.id !== 'local') return fail(404, 'not-found')
  return answer(
    ConfirmReceipt.parse({ confirmed: await confirmSignup(payload, parsed.data.token) }),
  )
}

const today = () => new Date().toISOString().slice(0, 10)

const ROUTES: Record<string, Limited> = {
  '/submissions': 'submissions',
  '/subscriptions': 'subscriptions',
  '/subscriptions/confirm': 'confirm',
}

/** Answers a POST for `/api/v1{path}`. */
export async function respondV1Post(
  request: Request,
  path: string,
  getPayload: () => Promise<Payload>,
): Promise<Response> {
  const route = ROUTES[path]
  if (!route) return fail(404, 'not-found')
  try {
    const payload = await getPayload()
    const address = scrambleAddress(payload.secret, clientAddress(request.headers))
    if (!limits[route].allow(address)) {
      return fail(429, 'Too many from here just now. Try again in a while.')
    }
    if (route === 'submissions') return await submissions(payload, request, address)
    if (route === 'subscriptions') return await subscriptions(payload, request)
    return await confirm(payload, request)
  } catch (error) {
    console.error(`POST /api/v1${path} failed`, error)
    return fail(500, 'Internal server error')
  }
}
