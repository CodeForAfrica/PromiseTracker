import {
  checkToken,
  createLocalCaptcha,
  createRateLimiter,
  leadingZeroBits,
  makeChallenge,
  scrambleAddress,
  solveChallenge,
  submissionFileType,
} from '@promisetracker/plugin-core'
import { describe, expect, it } from 'vitest'

const secret = 'a-test-secret'
const ctx = { payload: { secret } } as never

describe('the local captcha (D32)', () => {
  it('scrambles an address the same way each time, and never shows it', () => {
    const a = scrambleAddress('203.0.113.9', secret)
    expect(a).toBe(scrambleAddress('203.0.113.9', secret))
    expect(a).not.toBe(scrambleAddress('203.0.113.10', secret))
    expect(a).not.toContain('203')
    expect(a).not.toBe(scrambleAddress('203.0.113.9', 'another-secret'))
  })

  it('counts leading zero bits', () => {
    expect(leadingZeroBits(new Uint8Array([0, 0x10]))).toBe(11)
    expect(leadingZeroBits(new Uint8Array([0x80]))).toBe(0)
  })

  it('accepts a solved challenge, and nothing forged, altered or expired', () => {
    const now = 1_000_000
    const challenge = makeChallenge(secret, now, 8)
    const token = solveChallenge(challenge)
    expect(checkToken(token, secret, now)).not.toBeNull()
    expect(checkToken(token, 'another-secret', now)).toBeNull()
    expect(checkToken(token.replace('.8.', '.1.'), secret, now)).toBeNull()
    expect(checkToken(`${challenge}.x`, secret, now)).toBeNull()
    expect(checkToken(token, secret, now + 16 * 60_000)).toBeNull()
  })

  it('limits each key within a window', () => {
    let time = 0
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => time })
    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([
      true,
      true,
      false,
    ])
    expect(limiter.allow('b')).toBe(true)
    time = 1000
    expect(limiter.allow('a')).toBe(true)
  })

  it('passes a form once, never with the trap filled, and within the rate limit', async () => {
    const captcha = createLocalCaptcha({ limit: { limit: 3, windowMs: 60_000 } })
    const fresh = async () => {
      const { data } = await captcha.challenge(ctx)
      return solveChallenge(String(data.challenge))
    }
    const token = await fresh()
    expect(await captcha.verify(token, { ip: '192.0.2.1', trap: 'x' }, ctx)).toBe(false)
    expect(await captcha.verify(token, { ip: '192.0.2.1' }, ctx)).toBe(true)
    expect(await captcha.verify(token, { ip: '192.0.2.2' }, ctx)).toBe(false)
    expect(await captcha.verify(await fresh(), { ip: '192.0.2.1' }, ctx)).toBe(true)
    // The fourth attempt from one address in the window is refused, even when solved.
    expect(await captcha.verify(await fresh(), { ip: '192.0.2.1' }, ctx)).toBe(false)
  })
})

describe('submission files', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  it('takes a photo or PDF whose bytes, type and name agree', () => {
    expect(submissionFileType({ filename: 'a.png', declaredType: 'image/png', data: png })).toBe(
      'image/png',
    )
    expect(submissionFileType({ filename: 'a.png', data: png })).toBe('image/png')
  })
  it('refuses a mismatch or another kind of file', () => {
    expect(submissionFileType({ filename: 'a.jpg', declaredType: 'image/png', data: png })).toBe(
      null,
    )
    expect(submissionFileType({ filename: 'a.png', declaredType: 'image/jpeg', data: png })).toBe(
      null,
    )
    const html = new TextEncoder().encode('<html>')
    expect(submissionFileType({ filename: 'a.png', declaredType: 'image/png', data: html })).toBe(
      null,
    )
  })
})
