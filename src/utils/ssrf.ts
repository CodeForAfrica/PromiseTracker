import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guards for remote-file ingestion (SSRF protection).
 *
 * Every remote download must:
 * - use HTTPS (unless explicitly relaxed),
 * - optionally match a hostname allowlist,
 * - never resolve to private, loopback, link-local, CGNAT, cloud-metadata,
 *   multicast, or otherwise non-public addresses — for the initial URL and
 *   for every redirect destination.
 */

export type LookupAddress = { address: string; family: number };

export type LookupFn = (
  hostname: string,
) => Promise<LookupAddress[] | LookupAddress>;

const defaultLookup: LookupFn = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

type Ipv4Range = { base: number; maskBits: number };

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
};

const ipv4Range = (cidr: string): Ipv4Range => {
  const [base, bits] = cidr.split("/");
  return { base: ipv4ToInt(base)! >>> 0, maskBits: Number(bits) };
};

// Non-public IPv4 space: unspecified, private, loopback, link-local (incl.
// the 169.254.169.254 cloud-metadata endpoint), CGNAT, benchmarking,
// documentation/test nets, multicast, and reserved/broadcast.
const BLOCKED_IPV4_RANGES: Ipv4Range[] = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/3",
].map(ipv4Range);

const isBlockedIpv4 = (ip: string): boolean => {
  const value = ipv4ToInt(ip);
  if (value === null) {
    return true;
  }

  return BLOCKED_IPV4_RANGES.some(({ base, maskBits }) => {
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
    return (value & mask) === (base & mask);
  });
};

/** Expand an IPv6 address string into its 8 16-bit groups. */
const parseIpv6Groups = (ip: string): number[] | null => {
  let address = ip;

  // Strip zone index (fe80::1%eth0).
  const zoneIndex = address.indexOf("%");
  if (zoneIndex !== -1) {
    address = address.slice(0, zoneIndex);
  }

  // Convert a trailing embedded IPv4 (::ffff:127.0.0.1) into two groups.
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = ipv4ToInt(tail);
    if (v4 === null) {
      return null;
    }
    address =
      address.slice(0, lastColon + 1) +
      `${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }

  const halves = address.split("::");
  if (halves.length > 2) {
    return null;
  }

  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - rest.length;
  if (halves.length === 2 && fill < 0) {
    return null;
  }
  if (halves.length === 1 && head.length !== 8) {
    return null;
  }

  const groups = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? fill : 0 }, () => "0"),
    ...rest,
  ];

  if (groups.length !== 8) {
    return null;
  }

  const parsed = groups.map((group) => Number.parseInt(group || "0", 16));
  return parsed.every((value) => Number.isFinite(value) && value <= 0xffff)
    ? parsed
    : null;
};

const groupsToIpv4 = (high: number, low: number): string =>
  `${(high >>> 8) & 0xff}.${high & 0xff}.${(low >>> 8) & 0xff}.${low & 0xff}`;

const isBlockedIpv6 = (ip: string): boolean => {
  const groups = parseIpv6Groups(ip);
  if (!groups) {
    return true;
  }

  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  const allZeroThrough = (until: number) =>
    groups.slice(0, until).every((value) => value === 0);

  // :: (unspecified) and ::1 (loopback)
  if (allZeroThrough(7) && (g7 === 0 || g7 === 1)) {
    return true;
  }

  // ::ffff:a.b.c.d — IPv4-mapped; defer to the IPv4 rules.
  if (allZeroThrough(5) && g5 === 0xffff) {
    return isBlockedIpv4(groupsToIpv4(g6, g7));
  }

  // 64:ff9b::/96 — NAT64; defer to the embedded IPv4.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) {
    return isBlockedIpv4(groupsToIpv4(g6, g7));
  }

  // 2002::/16 — 6to4; the next two groups embed an IPv4 address.
  if (g0 === 0x2002) {
    return isBlockedIpv4(groupsToIpv4(g1, g2));
  }

  // fc00::/7 (unique local), fe80::/10 (link-local), fec0::/10 (site-local)
  if ((g0 & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((g0 & 0xffc0) === 0xfe80 || (g0 & 0xffc0) === 0xfec0) {
    return true;
  }

  // ff00::/8 multicast, 2001:db8::/32 documentation
  if ((g0 & 0xff00) === 0xff00) {
    return true;
  }
  if (g0 === 0x2001 && g1 === 0x0db8) {
    return true;
  }

  return false;
};

/**
 * Returns true when the IP address must never be dialled by a remote
 * download: private, loopback, link-local, cloud-metadata, or otherwise
 * non-public unicast space. Unparseable addresses are treated as blocked.
 */
export const isBlockedIpAddress = (ip: string): boolean => {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const version = isIP(trimmed);

  if (version === 4) {
    return isBlockedIpv4(trimmed);
  }
  if (version === 6) {
    return isBlockedIpv6(trimmed);
  }
  return true;
};

const normalizeHostRule = (rule: string): string =>
  rule.trim().toLowerCase().replace(/\.$/, "");

/**
 * Matches a hostname against an allowlist entry. Entries are either exact
 * hostnames ("assets.checkmedia.org") or wildcard suffixes
 * ("*.checkmedia.org", which also matches the bare apex).
 */
export const isHostnameAllowed = (
  hostname: string,
  allowedHostnames: string[],
): boolean => {
  const normalizedHost = normalizeHostRule(hostname);

  return allowedHostnames.some((rawRule) => {
    const rule = normalizeHostRule(rawRule);
    if (!rule) {
      return false;
    }

    if (rule.startsWith("*.")) {
      const suffix = rule.slice(2);
      return (
        normalizedHost === suffix || normalizedHost.endsWith(`.${suffix}`)
      );
    }

    return normalizedHost === rule;
  });
};

export class UnsafeRemoteUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeRemoteUrlError";
  }
}

export type SafeRemoteUrlOptions = {
  allowedHostnames?: string[];
  requireHttps?: boolean;
  /**
   * Skips the blocked-address checks. ONLY for URLs the application built
   * itself against its own configured origin (e.g. fetching its own media
   * in development) — never for URLs that contain external input.
   */
  allowPrivateAddresses?: boolean;
};

/**
 * Validates URL shape only (protocol, allowlist, credentials, IP-literal
 * hosts). DNS-resolved addresses are validated separately via
 * assertResolvesToPublicAddresses.
 */
export const assertSafeRemoteUrl = (
  url: URL,
  {
    allowedHostnames,
    requireHttps = true,
    allowPrivateAddresses = false,
  }: SafeRemoteUrlOptions = {},
): void => {
  if (requireHttps) {
    if (url.protocol !== "https:") {
      throw new UnsafeRemoteUrlError(
        `Blocked non-HTTPS download URL: ${url.protocol}//${url.host}`,
      );
    }
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeRemoteUrlError(
      `Blocked non-HTTP(S) download URL: ${url.protocol}`,
    );
  }

  if (url.username || url.password) {
    throw new UnsafeRemoteUrlError(
      "Blocked download URL with embedded credentials",
    );
  }

  const bareHostname = url.hostname.replace(/^\[|\]$/g, "");

  if (allowedHostnames && allowedHostnames.length > 0) {
    if (!isHostnameAllowed(url.hostname, allowedHostnames)) {
      throw new UnsafeRemoteUrlError(
        `Download host "${url.hostname}" is not in the configured allowlist`,
      );
    }
  }

  if (
    !allowPrivateAddresses &&
    isIP(bareHostname) !== 0 &&
    isBlockedIpAddress(bareHostname)
  ) {
    throw new UnsafeRemoteUrlError(
      `Download host resolves to a blocked address: ${bareHostname}`,
    );
  }
};

/**
 * Resolves the hostname and rejects when any resolved address is
 * non-public. IP-literal hostnames are validated directly.
 */
export const assertResolvesToPublicAddresses = async (
  url: URL,
  lookup: LookupFn = defaultLookup,
): Promise<void> => {
  const bareHostname = url.hostname.replace(/^\[|\]$/g, "");

  if (isIP(bareHostname) !== 0) {
    if (isBlockedIpAddress(bareHostname)) {
      throw new UnsafeRemoteUrlError(
        `Download host resolves to a blocked address: ${bareHostname}`,
      );
    }
    return;
  }

  let resolved: LookupAddress[];
  try {
    const result = await lookup(bareHostname);
    resolved = Array.isArray(result) ? result : [result];
  } catch (error) {
    throw new UnsafeRemoteUrlError(
      `Failed to resolve download host "${bareHostname}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (resolved.length === 0) {
    throw new UnsafeRemoteUrlError(
      `Download host "${bareHostname}" did not resolve to any address`,
    );
  }

  for (const { address } of resolved) {
    if (isBlockedIpAddress(address)) {
      throw new UnsafeRemoteUrlError(
        `Download host "${bareHostname}" resolves to a blocked address: ${address}`,
      );
    }
  }
};

/** Parses a comma-separated hostname allowlist from an env value. */
export const parseHostnameAllowlist = (
  value: string | null | undefined,
): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
