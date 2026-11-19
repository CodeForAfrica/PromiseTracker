import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { ValidationError } from '@promisetracker/kernel'

/**
 * Guards for the link connector, the one place the server fetches an address
 * a user typed (section 13.4). From v2's `src/utils/ssrf.ts`.
 *
 * Every fetch uses HTTPS, may match a host allowlist, and never reaches a
 * private, loopback, link-local, shared, cloud metadata, multicast or
 * otherwise non-public address: for the first address and for every redirect.
 */

export type LookupAddress = { address: string; family: number }
export type LookupFn = (hostname: string) => Promise<LookupAddress[] | LookupAddress>

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true, verbatim: true })

type Ipv4Range = { base: number; maskBits: number }

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const octet = Number(part)
    if (octet > 255) return null
    value = value * 256 + octet
  }
  return value >>> 0
}

const ipv4Range = (cidr: string): Ipv4Range => {
  const [base = '', bits = '32'] = cidr.split('/')
  return { base: (ipv4ToInt(base) ?? 0) >>> 0, maskBits: Number(bits) }
}

// Unspecified, private, shared (CGNAT), loopback, link-local with the
// 169.254.169.254 metadata address, benchmarking, documentation, multicast
// and reserved space.
const BLOCKED_IPV4_RANGES: readonly Ipv4Range[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/3',
].map(ipv4Range)

const isBlockedIpv4 = (ip: string): boolean => {
  const value = ipv4ToInt(ip)
  if (value === null) return true
  return BLOCKED_IPV4_RANGES.some(({ base, maskBits }) => {
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0
    return (value & mask) === (base & mask)
  })
}

/** An IPv6 address as its eight 16-bit groups. */
const parseIpv6Groups = (ip: string): number[] | null => {
  let address = ip
  // A zone index, as in fe80::1%eth0.
  const zone = address.indexOf('%')
  if (zone !== -1) address = address.slice(0, zone)

  // A trailing IPv4 address, as in ::ffff:127.0.0.1, becomes two groups.
  const lastColon = address.lastIndexOf(':')
  const tail = address.slice(lastColon + 1)
  if (tail.includes('.')) {
    const v4 = ipv4ToInt(tail)
    if (v4 === null) return null
    address = `${address.slice(0, lastColon + 1)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`
  }

  const halves = address.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - rest.length
  if (halves.length === 2 && fill < 0) return null
  if (halves.length === 1 && head.length !== 8) return null
  const groups = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? fill : 0 }, () => '0'),
    ...rest,
  ]
  if (groups.length !== 8) return null
  if (!groups.every((g) => /^[0-9a-f]{0,4}$/i.test(g))) return null
  return groups.map((g) => Number.parseInt(g || '0', 16))
}

const groupsToIpv4 = (high: number, low: number): string =>
  `${(high >>> 8) & 0xff}.${high & 0xff}.${(low >>> 8) & 0xff}.${low & 0xff}`

const isBlockedIpv6 = (ip: string): boolean => {
  const groups = parseIpv6Groups(ip)
  if (!groups) return true
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups
  const zeroUntil = (until: number) => groups.slice(0, until).every((v) => v === 0)

  // :: and ::1
  if (zeroUntil(7) && (g7 === 0 || g7 === 1)) return true
  // ::a.b.c.d, the retired IPv4-compatible form. Nothing public uses it, and a
  // system may still route it to the IPv4 address inside, such as ::7f00:1.
  if (zeroUntil(6)) return true
  // ::ffff:a.b.c.d, an IPv4 address in IPv6 form
  if (zeroUntil(5) && g5 === 0xffff) return isBlockedIpv4(groupsToIpv4(g6, g7))
  // 64:ff9b::/96, NAT64
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(groupsToIpv4(g6, g7))
  }
  // 2002::/16, 6to4, with an IPv4 address in the next two groups
  if (g0 === 0x2002) return isBlockedIpv4(groupsToIpv4(g1, g2))
  // fc00::/7 unique local, fe80::/10 link-local, fec0::/10 site-local
  if ((g0 & 0xfe00) === 0xfc00) return true
  if ((g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0) return true
  // ff00::/8 multicast, 2001:db8::/32 documentation
  if ((g0 & 0xff00) === 0xff00) return true
  if (g0 === 0x2001 && g1 === 0x0db8) return true
  // 2001::/32, Teredo, which tunnels to an IPv4 address carried inside it
  if (g0 === 0x2001 && g1 === 0) return true
  return false
}

/**
 * Whether an address must never be fetched: anything but public unicast
 * space. An address that cannot be read counts as blocked.
 */
export const isBlockedIpAddress = (ip: string): boolean => {
  const trimmed = ip.trim().replace(/^\[/, '').replace(/\]$/, '')
  const version = isIP(trimmed)
  if (version === 4) return isBlockedIpv4(trimmed)
  if (version === 6) return isBlockedIpv6(trimmed)
  return true
}

const normalizeHostRule = (rule: string): string => rule.trim().toLowerCase().replace(/\.$/, '')

/**
 * Matches a host against an allowlist. An entry is a host name, or `*.` and a
 * suffix, which also matches the bare suffix.
 */
export const isHostnameAllowed = (hostname: string, allowed: readonly string[]): boolean => {
  const host = normalizeHostRule(hostname)
  return allowed.some((raw) => {
    const rule = normalizeHostRule(raw)
    if (!rule) return false
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(2)
      return host === suffix || host.endsWith(`.${suffix}`)
    }
    return host === rule
  })
}

/** A link the connector refuses to fetch. Never retried. */
export class UnsafeRemoteUrlError extends ValidationError {
  override name = 'UnsafeRemoteUrlError'
}

export type SafeRemoteUrlOptions = {
  allowedHostnames?: readonly string[]
  requireHttps?: boolean
}

const bare = (url: URL) => url.hostname.replace(/^\[/, '').replace(/\]$/, '')

/**
 * Checks a link's form: the scheme, the allowlist, credentials, and an
 * address written as a host. Names are looked up by
 * `assertResolvesToPublicAddresses`.
 */
export const assertSafeRemoteUrl = (
  url: URL,
  { allowedHostnames, requireHttps = true }: SafeRemoteUrlOptions = {},
): void => {
  if (requireHttps) {
    if (url.protocol !== 'https:') {
      throw new UnsafeRemoteUrlError(`Blocked non-HTTPS link: ${url.protocol}//${url.host}`)
    }
  } else if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeRemoteUrlError(`Blocked non-HTTP(S) link: ${url.protocol}`)
  }
  if (url.username || url.password) {
    throw new UnsafeRemoteUrlError('Blocked link with embedded credentials')
  }
  if (allowedHostnames && allowedHostnames.length > 0) {
    if (!isHostnameAllowed(url.hostname, allowedHostnames)) {
      throw new UnsafeRemoteUrlError(`Host "${url.hostname}" is not in the configured allowlist`)
    }
  }
  const host = bare(url)
  if (isIP(host) !== 0 && isBlockedIpAddress(host)) {
    throw new UnsafeRemoteUrlError(`Host resolves to a blocked address: ${host}`)
  }
}

/** Looks the host up and refuses it if any of its addresses is not public. */
export const assertResolvesToPublicAddresses = async (
  url: URL,
  lookup: LookupFn = defaultLookup,
): Promise<void> => {
  const host = bare(url)
  if (isIP(host) !== 0) {
    if (isBlockedIpAddress(host)) {
      throw new UnsafeRemoteUrlError(`Host resolves to a blocked address: ${host}`)
    }
    return
  }
  let resolved: LookupAddress[]
  try {
    const result = await lookup(host)
    resolved = Array.isArray(result) ? result : [result]
  } catch (error) {
    throw new UnsafeRemoteUrlError(
      `Failed to resolve host "${host}": ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (resolved.length === 0) {
    throw new UnsafeRemoteUrlError(`Host "${host}" did not resolve to any address`)
  }
  for (const { address } of resolved) {
    if (isBlockedIpAddress(address)) {
      throw new UnsafeRemoteUrlError(`Host "${host}" resolves to a blocked address: ${address}`)
    }
  }
}

/** A comma-separated host allowlist, as an environment value or setting holds it. */
export const parseHostnameAllowlist = (value: string | null | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
