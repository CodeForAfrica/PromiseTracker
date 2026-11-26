import {
  CHALLENGE_TTL_MS,
  checkAnswer,
  clientAddress,
  createRateLimiter,
  hasLeadingZeroBits,
  newChallenge,
  POW_BITS,
  powHash,
  scrambleAddress,
  solve,
} from '@promisetracker/plugin-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The `local` captcha and rate limits (sections 6.5 and 13.5, D32): a signed
 * proof-of-work challenge, answered once, and limits per scrambled address.
 * The rate limiter's tests come from v2's `tests/int/requestGuards.int.spec.ts`.
 */
const SECRET = 'test-secret-not-used-anywhere-else'

afterEach(() => {
  vi.useRealTimers()
})

describe('the proof-of-work captcha', () => {
  it('counts leading zero bits', () => {
    expect(hasLeadingZeroBits('00ff', 8)).toBe(true)
    expect(hasLeadingZeroBits('01ff', 8)).toBe(false)
    expect(hasLeadingZeroBits('0fff', 4)).toBe(true)
    expect(hasLeadingZeroBits('07ff', 5)).toBe(true)
    expect(hasLeadingZeroBits('08ff', 5)).toBe(false)
  })

  it('accepts a solved challenge once', () => {
    const { challenge, bits } = newChallenge(SECRET)
    expect(bits).toBe(POW_BITS)
    const nonce = solve(challenge)
    expect(hasLeadingZeroBits(powHash(challenge, nonce), POW_BITS)).toBe(true)
    expect(checkAnswer(SECRET, `${challenge}:${nonce}`)).toBe(true)
    // Spent.
    expect(checkAnswer(SECRET, `${challenge}:${nonce}`)).toBe(false)
  })

  it('refuses an unsolved, forged or expired answer', () => {
    const { challenge } = newChallenge(SECRET)
    const nonce = solve(challenge)
    // A nonce that does not solve it.
    const wrong = [...Array(50).keys()]
      .map(String)
      .find((n) => !hasLeadingZeroBits(powHash(challenge, n), POW_BITS))
    expect(checkAnswer(SECRET, `${challenge}:${wrong}`)).toBe(false)
    // Signed with another secret.
    expect(checkAnswer('another-secret', `${challenge}:${nonce}`)).toBe(false)
    // Its time changed.
    const [time = '', random = '', signature = ''] = challenge.split('.')
    const forged = `${Number(time) + 1}.${random}.${signature}`
    expect(checkAnswer(SECRET, `${forged}:${solve(forged)}`)).toBe(false)
    // Too old.
    const old = newChallenge(SECRET, Date.now() - CHALLENGE_TTL_MS - 1)
    expect(checkAnswer(SECRET, `${old.challenge}:${solve(old.challenge)}`)).toBe(false)
    // Not an answer at all.
    expect(checkAnswer(SECRET, 'nonsense')).toBe(false)
  })
})

describe('rate limits', () => {
  it('allows up to the limit per window, then blocks', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    expect(limiter.allow('a')).toBe(true)
    expect(limiter.allow('a')).toBe(true)
    expect(limiter.allow('a')).toBe(true)
    expect(limiter.allow('a')).toBe(false)
    // Other senders are counted on their own.
    expect(limiter.allow('b')).toBe(true)
  })

  it('resets after the window', () => {
    vi.useFakeTimers()
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 })
    expect(limiter.allow('a')).toBe(true)
    expect(limiter.allow('a')).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(limiter.allow('a')).toBe(true)
  })

  it('scrambles an address the same way each time, and cannot be read back', () => {
    const one = scrambleAddress(SECRET, '203.0.113.7')
    expect(one).toBe(scrambleAddress(SECRET, '203.0.113.7'))
    expect(one).not.toBe(scrambleAddress(SECRET, '203.0.113.8'))
    expect(one).not.toContain('203')
    expect(one).toMatch(/^[0-9a-f]{16}$/)
  })

  it("takes the sender's address from the proxy's own entry", () => {
    // A sender can put anything first. The proxy adds the address it saw last.
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.7' })
    expect(clientAddress(headers)).toBe('203.0.113.7')
    expect(clientAddress(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
    expect(clientAddress(new Headers())).toBe('unknown')
  })
})
