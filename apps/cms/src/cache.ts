import { createHmac, timingSafeEqual } from 'node:crypto'

import type { TagRefresher } from '@promisetracker/plugin-core'

type Env = Readonly<Record<string, string | undefined>>

/** The internal route that refreshes the site's cached pages (section 11.3). */
export const REVALIDATE_PATH = '/api/internal/revalidate'
export const SIGNATURE_HEADER = 'x-pt-signature'

const MAX_TAGS = 100
const MAX_TAG_LENGTH = 256
const TIMEOUT_MS = 5_000
/**
 * How old a signed refresh request may be. Older ones are refused, so a copy
 * cannot be replayed later. Within the minute a copy can be sent again, which
 * is accepted: all it can do is refresh pages that are already up to date.
 */
export const MAX_AGE_MS = 60 * 1000
/** How far ahead of this process's clock a request's time may be, for clocks that drift a little. */
export const CLOCK_SKEW_MS = 5 * 1000

/** Where the web process listens, for a call from this process or the worker. */
export function webUrl(env: Env = process.env): string {
  const configured = env.PT_WEB_URL?.trim()
  const url = configured || `http://127.0.0.1:${env.PORT?.trim() || '3000'}`
  // Trailing slashes are dropped with a loop: a pattern for them is slow on a long run of slashes.
  let end = url.length
  while (end > 0 && url[end - 1] === '/') end -= 1
  return url.slice(0, end)
}

/**
 * Signs a refresh request with the application secret, so the route needs no
 * secret of its own (D47). A key derived for this one use keeps the signature
 * from being useful anywhere else.
 */
function key(secret: string): Buffer {
  return createHmac('sha256', secret).update('promisetracker:revalidate').digest()
}

export function sign(body: string, secret: string): string {
  return createHmac('sha256', key(secret)).update(body).digest('hex')
}

export function verify(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  const expected = Buffer.from(sign(body, secret), 'hex')
  const given = Buffer.from(signature, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** The tags in a signed refresh request, or null when it is not one. */
export function readRefreshRequest(
  body: string,
  signature: string | null,
  secret: string,
  now: number = Date.now(),
): string[] | null {
  if (!verify(body, signature, secret)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  const field = (name: string): unknown =>
    parsed && typeof parsed === 'object' ? Reflect.get(parsed, name) : null
  const at = field('at')
  if (typeof at !== 'number' || now - at > MAX_AGE_MS || at - now > CLOCK_SKEW_MS) return null
  const tags = field('tags')
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > MAX_TAGS) return null
  const valid = tags.every(
    (tag): tag is string =>
      typeof tag === 'string' && tag.length > 0 && tag.length <= MAX_TAG_LENGTH,
  )
  return valid ? tags : null
}

/**
 * Asks the web process to refresh tags. The web process calls itself too, so
 * a save in the admin and a background job in the worker take the same path.
 * A failure is logged and never fails the save: the page refreshes on the
 * next change.
 */
export function createHttpRefresher(env: Env = process.env): TagRefresher {
  return async (tags, req) => {
    if (tags.length === 0) return
    const secret = env.PAYLOAD_SECRET ?? ''
    const body = JSON.stringify({ tags, at: Date.now() })
    try {
      const res = await fetch(`${webUrl(env)}${REVALIDATE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: sign(body, secret) },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
    } catch (error) {
      req.payload.logger.warn({
        msg: 'Could not refresh the site’s cached pages. They refresh on the next change.',
        tags,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
