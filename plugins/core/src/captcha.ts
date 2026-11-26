import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import type { AdapterContext, CaptchaProvider } from '@promisetracker/kernel'

/**
 * The `local` captcha (section 6.5, D32): a proof-of-work check in the
 * browser, a hidden trap field and rate limits, with no outside service.
 *
 * A challenge is a random value with its time, signed with the app's secret,
 * so the server keeps nothing until an answer comes back. The browser finds a
 * number that, hashed with the challenge, starts with enough zero bits. That
 * takes a second or two once, and makes sending thousands of forms costly.
 * Each solved challenge is accepted once, and only for a while.
 */

/** Leading zero bits a solution needs: about 65,000 tries, a second or two on a phone. */
export const POW_BITS = 16
/** How long a challenge can be answered. */
export const CHALLENGE_TTL_MS = 10 * 60_000

const secretOf = (ctx: Pick<AdapterContext, 'payload'>): string => ctx.payload.secret

const sign = (secret: string, body: string): string =>
  createHmac('sha256', secret).update(`captcha:${body}`).digest('base64url')

/** Whether a hash, as hex, starts with `bits` zero bits. */
export function hasLeadingZeroBits(hex: string, bits: number): boolean {
  const whole = Math.floor(bits / 4)
  if (!hex.startsWith('0'.repeat(whole))) return false
  const rest = bits % 4
  if (rest === 0) return true
  const next = Number.parseInt(hex.charAt(whole), 16)
  return next < 2 ** (4 - rest)
}

/** The hash a solution is checked with, the same one the browser computes. */
export const powHash = (challenge: string, nonce: string): string =>
  createHash('sha256').update(`${challenge}:${nonce}`).digest('hex')

/** Finds a solution. The browser does this. Tests and scripts use it here. */
export function solve(challenge: string, bits = POW_BITS): string {
  for (let n = 0; ; n++) {
    if (hasLeadingZeroBits(powHash(challenge, String(n)), bits)) return String(n)
  }
}

/** Solved challenges, until they would have expired anyway. Per process. */
const spent = new Map<string, number>()

function forget(now: number) {
  for (const [key, until] of spent) if (until < now) spent.delete(key)
}

export type Challenge = { challenge: string; bits: number }

/** A new challenge: `{time}.{random}.{signature}`. */
export function newChallenge(secret: string, now = Date.now()): Challenge {
  const body = `${now}.${randomBytes(12).toString('base64url')}`
  return { challenge: `${body}.${sign(secret, body)}`, bits: POW_BITS }
}

/**
 * Checks an answer, `{challenge}:{nonce}`: signed by us, not expired, solved,
 * and not used before.
 */
export function checkAnswer(secret: string, answer: string, now = Date.now()): boolean {
  const split = answer.lastIndexOf(':')
  if (split < 0) return false
  const challenge = answer.slice(0, split)
  const nonce = answer.slice(split + 1)
  const [time = '', random = '', signature = ''] = challenge.split('.')
  if (!time || !random || !signature || !/^\d{1,8}$/.test(nonce)) return false
  const expected = Buffer.from(sign(secret, `${time}.${random}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false
  const issued = Number(time)
  if (!Number.isFinite(issued) || now - issued > CHALLENGE_TTL_MS || issued - now > 60_000) {
    return false
  }
  if (!hasLeadingZeroBits(powHash(challenge, nonce), POW_BITS)) return false
  forget(now)
  if (spent.has(challenge)) return false
  spent.set(challenge, issued + CHALLENGE_TTL_MS)
  return true
}

export const localCaptcha: CaptchaProvider = {
  id: 'local',
  health: async () => ({ healthy: true }),
  challenge: async (ctx) => {
    const { challenge, bits } = newChallenge(secretOf(ctx))
    return { kind: 'proof-of-work', data: { challenge, bits } }
  },
  verify: async (token, _request, ctx) => checkAnswer(secretOf(ctx), token),
}

// Rate limits (section 13.5), from v2's `src/utils/requestGuards.ts`.

/**
 * A fixed-window limit per key. Kept in the process: with several web
 * replicas each counts on its own, which still bounds a single sender.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return {
    allow(key: string, now = Date.now()): boolean {
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k)
      }
      const entry = hits.get(key)
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs })
        return true
      }
      entry.count += 1
      return entry.count <= limit
    },
  }
}

/**
 * A scrambled form of a network address (section 13.5): the same address
 * always gives the same value, so repeated abuse shows, but the address
 * cannot be read back from it without the app's secret.
 */
export const scrambleAddress = (secret: string, address: string): string =>
  createHmac('sha256', secret).update(`address:${address}`).digest('hex').slice(0, 16)

/**
 * The sender's address. Behind the proxy, the last entry of
 * `X-Forwarded-For` is the one the proxy itself saw, which a sender cannot
 * choose.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  const last = forwarded?.split(',').at(-1)?.trim()
  return last || headers.get('x-real-ip')?.trim() || 'unknown'
}
