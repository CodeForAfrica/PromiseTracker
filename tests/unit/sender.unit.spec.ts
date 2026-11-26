import { proxyHops, senderOf } from '@promisetracker/cms'
import { describe, expect, it } from 'vitest'

/**
 * Whose address the forms' rate limit counts (sections 12.2 and 13.5). Each
 * proxy appends what it saw to `X-Forwarded-For`, so the first entries are
 * whatever the sender wrote.
 */
const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) })

describe('the sender of a form', () => {
  it('is the address the proxy saw, not one the sender wrote', () => {
    // A sender sets the header to anything. Dokku's nginx appends the real address.
    const forged = request({ 'x-forwarded-for': '203.0.113.99, 198.51.100.7' })
    expect(senderOf(forged, {}).ip).toBe('198.51.100.7')
    // A new forged value each time still counts as the same sender.
    const again = request({ 'x-forwarded-for': '203.0.113.1, 198.51.100.7' })
    expect(senderOf(again, {}).ip).toBe('198.51.100.7')
  })

  it('counts each trusted proxy from the end', () => {
    // A CDN in front of nginx: the CDN saw the reader, nginx saw the CDN.
    const viaCdn = request({ 'x-forwarded-for': '203.0.113.99, 198.51.100.7, 192.0.2.10' })
    expect(senderOf(viaCdn, { PT_PROXY_HOPS: '2' }).ip).toBe('198.51.100.7')
    // Fewer entries than proxies: the earliest is the nearest there is.
    expect(
      senderOf(request({ 'x-forwarded-for': '198.51.100.7' }), { PT_PROXY_HOPS: '3' }).ip,
    ).toBe('198.51.100.7')
  })

  it('falls back to X-Real-IP, then to no address', () => {
    expect(senderOf(request({ 'x-real-ip': '198.51.100.8' }), {}).ip).toBe('198.51.100.8')
    expect(senderOf(request({ 'user-agent': 'test' }), {})).toEqual({ userAgent: 'test' })
  })

  it('reads PT_PROXY_HOPS, and takes one for anything that is not a positive whole number', () => {
    expect(proxyHops({})).toBe(1)
    expect(proxyHops({ PT_PROXY_HOPS: '2' })).toBe(2)
    expect(proxyHops({ PT_PROXY_HOPS: '0' })).toBe(1)
    expect(proxyHops({ PT_PROXY_HOPS: 'two' })).toBe(1)
  })
})
