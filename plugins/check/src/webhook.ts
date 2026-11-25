import { createHash, timingSafeEqual } from 'node:crypto'
import type { AdapterContext, VerdictUpdate, VerificationProvider } from '@promisetracker/kernel'
import { createLog } from '@promisetracker/kernel'
import { applyVerdictUpdates, recordSync } from '@promisetracker/plugin-core'
import type { Payload } from 'payload'
import { createPayloadRequest } from 'payload'
import { readCheckSettings } from './settings'

type Answer = { status: number; body: Record<string, unknown> }

/** How long a delivery's answer is kept for a repeat of it. Check retries within minutes. */
export const FINGERPRINT_TTL_MS = 10 * 60_000
const MAX_FINGERPRINTS = 1_000

/**
 * Answers by body fingerprint, carried over from v2. A repeat gets the first
 * delivery's answer, and one that arrives while the first is still running
 * waits for it. Kept per process: a repeat that reaches another process is
 * applied again, which changes nothing, since a verdict applied twice is the same.
 */
const answers = new Map<string, { at: number; answer: Promise<Answer> }>()

/** Forgets every fingerprint. For tests. */
export function forgetDeliveries(): void {
  answers.clear()
}

function remembered(fingerprint: string, now: number): Promise<Answer> | null {
  for (const [key, entry] of answers) {
    if (now - entry.at > FINGERPRINT_TTL_MS) answers.delete(key)
  }
  return answers.get(fingerprint)?.answer ?? null
}

function remember(fingerprint: string, answer: Promise<Answer>, now: number): void {
  if (answers.size >= MAX_FINGERPRINTS) {
    const oldest = answers.keys().next().value
    if (oldest !== undefined) answers.delete(oldest)
  }
  answers.set(fingerprint, { at: now, answer })
  // A failure is not kept, so Check's retry is processed again.
  answer.then(
    (a) => {
      if (a.status >= 500) answers.delete(fingerprint)
    },
    () => answers.delete(fingerprint),
  )
}

/** Compares in constant time. Check sends the secret as it is, or after `Bearer `. */
export function secretMatches(header: string | null, secret: string): boolean {
  if (!header) return false
  const given = header.replace(/^Bearer\s+/i, '').trim()
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

const json = ({ status, body }: Answer): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export type WebhookDeps = {
  payload: Payload
  adapter: VerificationProvider
  context: () => Promise<AdapterContext>
  now?: () => number
}

/** Applies the updates a delivery carries, and notes the sync on each claim. */
async function apply(
  payload: Payload,
  updates: readonly VerdictUpdate[],
  reportState: string,
  { recordUnchanged }: { recordUnchanged: boolean },
): Promise<Answer> {
  if (updates.length === 0) return { status: 200, body: { ok: true, applied: 0 } }
  const req = await createPayloadRequest({ payload })
  const outcomes = await applyVerdictUpdates(req, updates)
  const at = new Date().toISOString()
  for (const outcome of outcomes) {
    // The poll sees every published report each time, so it notes only changes.
    if (!outcome.claim || (!outcome.changed && !recordUnchanged)) continue
    await recordSync(req, outcome.claim, {
      'check.reportState': reportState,
      'check.syncedAt': at,
      'check.syncResult': outcome.changed ? 'applied' : 'unchanged',
    })
  }
  // An item PromiseTracker does not know is left for the poll (section 5.2).
  const unknown = outcomes.filter((o) => !o.claim).length
  return {
    status: 200,
    body: { ok: true, applied: outcomes.filter((o) => o.changed).length, unknown },
  }
}

/**
 * `POST /api/plugins/check/webhook` (section 5.2). The secret is checked
 * before the body is read. Only report events act. A repeat delivery gets the
 * first answer.
 */
export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const ctx = await deps.context()
  const log = createLog(ctx.logger, 'check')
  const { webhookSecret } = readCheckSettings(ctx.settings)
  if (!webhookSecret) {
    log.error('A Check webhook arrived, but no webhook secret is set')
    return json({ status: 503, body: { error: 'The Check webhook is not set up.' } })
  }
  if (!secretMatches(request.headers.get('authorization'), webhookSecret)) {
    return json({ status: 401, body: { error: 'Unauthorized' } })
  }

  const raw = await request.text()
  const now = deps.now?.() ?? Date.now()
  const fingerprint = createHash('sha256').update(raw).digest('hex')
  const earlier = remembered(fingerprint, now)
  if (earlier) {
    const answer = await earlier
    return json({ status: answer.status, body: { ...answer.body, repeated: true } })
  }

  const work = (async (): Promise<Answer> => {
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return { status: 400, body: { error: 'The body is not JSON.' } }
    }
    const object: unknown = body && typeof body === 'object' ? Reflect.get(body, 'object') : null
    const type: unknown =
      object && typeof object === 'object' ? Reflect.get(object, 'annotation_type') : null
    // Every other event is acknowledged and ignored.
    if (type !== 'report_design') return { status: 200, body: { ok: true, ignored: true } }
    if (!deps.adapter.receive) return { status: 200, body: { ok: true, ignored: true } }
    try {
      const updates = await deps.adapter.receive(body, request.headers, ctx)
      const state = updates.some((u) => u.withdrawn) ? 'paused' : 'published'
      return await apply(deps.payload, updates, state, { recordUnchanged: true })
    } catch (error) {
      log.error('Could not apply a Check webhook', { error })
      // Check retries a failed delivery, and the poll catches what it misses.
      return { status: 500, body: { error: 'Internal server error' } }
    }
  })()
  remember(fingerprint, work, now)
  return json(await work)
}

/**
 * The poll (section 5.2): every 15 minutes, every item with a published report
 * is reconciled. A webhook lost during a deploy is caught here.
 */
export async function pollCheck(deps: Omit<WebhookDeps, 'now'>): Promise<{ applied: number }> {
  const ctx = await deps.context()
  if (!readCheckSettings(ctx.settings).credentials) return { applied: 0 }
  const { updates } = await deps.adapter.pull(null, ctx)
  const answer = await apply(deps.payload, updates, 'published', { recordUnchanged: false })
  const applied = answer.body.applied
  return { applied: typeof applied === 'number' ? applied : 0 }
}
