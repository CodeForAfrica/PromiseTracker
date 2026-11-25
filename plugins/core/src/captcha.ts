import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import type { CaptchaProvider } from '@promisetracker/kernel'

/**
 * The `local` captcha (section 6.5, D32): no outside service. A form passes
 * when it carries a solved proof-of-work challenge, leaves the hidden trap
 * field empty, and its sender is within the rate limit.
 *
 * The server signs each challenge with Payload's secret, so it keeps nothing
 * until a solution arrives. A solution is accepted once. The browser finds a
 * nonce that gives the challenge's hash enough leading zero bits, which takes
 * a person's browser a second or two and a spammer's every request as long.
 */

/** Leading zero bits a solution's hash needs: about 65,000 tries on average. */
export const POW_DIFFICULTY = 16

/** How long a challenge may be solved and sent, in milliseconds. */
export const CHALLENGE_TTL_MS = 15 * 60_000

/** How many forms one network address may send in the window. */
export const FORM_LIMIT = { limit: 10, windowMs: 60 * 60_000 } as const

/** The name of the hidden trap field the forms carry. */
export const TRAP_FIELD = 'website'

/**
 * A network address, scrambled with the deployment's secret (section 13.5):
 * the same address always gives the same value, so repeated abuse shows, and
 * the address cannot be read back from it.
 */
export function scrambleAddress(address: string, secret: string): string {
  return createHmac('sha256', secret).update(`address:${address}`).digest('base64url').slice(0, 22)
}

type Limiter = { allow(key: string): boolean }

/**
 * A fixed-window limit per key, in this process. It forgets the oldest keys
 * beyond `maxKeys`, so a flood of addresses cannot exhaust memory.
 */
export function createRateLimiter(options: {
  limit: number
  windowMs: number
  maxKeys?: number
  now?: () => number
}): Limiter {
  const { limit, windowMs, maxKeys = 10_000, now = Date.now } = options
  const windows = new Map<string, { start: number; count: number }>()
  return {
    allow(key) {
      const time = now()
      const current = windows.get(key)
      if (!current || time - current.start >= windowMs) {
        windows.delete(key)
        windows.set(key, { start: time, count: 1 })
        if (windows.size > maxKeys) {
          const oldest = windows.keys().next().value
          if (oldest !== undefined) windows.delete(oldest)
        }
        return true
      }
      current.count += 1
      return current.count <= limit
    },
  }
}

/** How many zero bits a hash starts with. */
export function leadingZeroBits(bytes: Uint8Array): number {
  let bits = 0
  for (const byte of bytes) {
    if (byte === 0) {
      bits += 8
      continue
    }
    return bits + Math.clz32(byte) - 24
  }
  return bits
}

const sign = (secret: string, body: string) =>
  createHmac('sha256', secret).update(`captcha:${body}`).digest('base64url').slice(0, 32)

/** A signed challenge: version, expiry, difficulty, a random salt and the signature. */
export function makeChallenge(
  secret: string,
  now = Date.now(),
  difficulty = POW_DIFFICULTY,
): string {
  const body = `v1.${now + CHALLENGE_TTL_MS}.${difficulty}.${randomBytes(12).toString('base64url')}`
  return `${body}.${sign(secret, body)}`
}

const powOf = (token: string) => leadingZeroBits(createHash('sha256').update(token).digest())

/** Solves a challenge here, for tests and scripts. Browsers use the same rule. */
export function solveChallenge(challenge: string): string {
  const difficulty = Number(challenge.split('.')[2])
  for (let nonce = 0; ; nonce++) {
    const token = `${challenge}.${nonce}`
    if (powOf(token) >= difficulty) return token
  }
}

const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

/**
 * Checks a solved token, `v1.{expires}.{difficulty}.{salt}.{signature}.{nonce}`.
 * Returns the salt, which identifies the challenge, when it holds.
 */
export function checkToken(token: string, secret: string, now = Date.now()): string | null {
  const parts = token.split('.')
  if (parts.length !== 6) return null
  const [version, expires, difficulty, salt, signature, nonce] = parts
  if (version !== 'v1' || !salt || !signature || !nonce || !/^\d{1,12}$/.test(nonce)) return null
  if (!same(signature, sign(secret, `v1.${expires}.${difficulty}.${salt}`))) return null
  if (!(Number(expires) > now)) return null
  // The difficulty is signed, so it is the one the server set.
  if (powOf(token) < Number(difficulty)) return null
  return salt
}

/** A `local` captcha with its own rate limit and memory of used challenges. */
export function createLocalCaptcha(
  options: { now?: () => number; limit?: { limit: number; windowMs: number } } = {},
): CaptchaProvider {
  const now = options.now ?? Date.now
  const limiter = createRateLimiter({ ...(options.limit ?? FORM_LIMIT), now })
  // Each challenge passes once. Kept until it expires.
  const used = new Map<string, number>()
  return {
    id: 'local',
    health: async () => ({ healthy: true }),
    challenge: async (ctx) => ({
      kind: 'proof-of-work',
      data: {
        challenge: makeChallenge(ctx.payload.secret, now()),
        difficulty: POW_DIFFICULTY,
        trapField: TRAP_FIELD,
      },
    }),
    async verify(token, request, ctx) {
      const secret = ctx.payload.secret
      // Every attempt counts, so guessing tokens is rate limited too.
      const key = request.ip ? scrambleAddress(request.ip, secret) : 'unknown'
      if (!limiter.allow(key)) return false
      if (request.trap) return false
      const time = now()
      const salt = checkToken(token, secret, time)
      if (!salt) return false
      for (const [seen, expires] of used) if (expires <= time) used.delete(seen)
      if (used.has(salt)) return false
      used.set(salt, Number(token.split('.')[1]))
      return true
    },
  }
}

export const localCaptcha: CaptchaProvider = createLocalCaptcha()
