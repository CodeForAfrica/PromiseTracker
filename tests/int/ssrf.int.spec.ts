import { describe, expect, it } from "vitest";

import {
  assertResolvesToPublicAddresses,
  assertSafeRemoteUrl,
  isBlockedIpAddress,
  isHostnameAllowed,
  parseHostnameAllowlist,
} from "@/utils/ssrf";

describe("isBlockedIpAddress", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.255",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.0.0.1",
    "192.168.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:0001::",
    "not-an-ip",
  ])("blocks %s", (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(true);
  });

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "196.216.167.10",
    "172.32.0.1",
    "2606:4700::6810:85e5",
    "2a00:1450:4009:81f::200e",
  ])("allows public address %s", (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(false);
  });
});

describe("isHostnameAllowed", () => {
  it("matches exact hostnames case-insensitively", () => {
    expect(isHostnameAllowed("Assets.CheckMedia.org", ["assets.checkmedia.org"])).toBe(
      true,
    );
    expect(isHostnameAllowed("assets.checkmedia.org", ["checkmedia.org"])).toBe(
      false,
    );
  });

  it("matches wildcard suffixes including the apex", () => {
    expect(isHostnameAllowed("assets.checkmedia.org", ["*.checkmedia.org"])).toBe(
      true,
    );
    expect(isHostnameAllowed("checkmedia.org", ["*.checkmedia.org"])).toBe(true);
    expect(
      isHostnameAllowed("evilcheckmedia.org", ["*.checkmedia.org"]),
    ).toBe(false);
    expect(
      isHostnameAllowed("checkmedia.org.evil.com", ["*.checkmedia.org"]),
    ).toBe(false);
  });
});

describe("assertSafeRemoteUrl", () => {
  it("requires HTTPS by default", () => {
    expect(() =>
      assertSafeRemoteUrl(new URL("http://example.com/file")),
    ).toThrow(/non-HTTPS/);
  });

  it("rejects blocked IP literals", () => {
    expect(() =>
      assertSafeRemoteUrl(new URL("https://169.254.169.254/creds")),
    ).toThrow(/blocked address/);
  });

  it("enforces the allowlist when provided", () => {
    expect(() =>
      assertSafeRemoteUrl(new URL("https://example.com/file"), {
        allowedHostnames: ["*.checkmedia.org"],
      }),
    ).toThrow(/allowlist/);

    expect(() =>
      assertSafeRemoteUrl(new URL("https://assets.checkmedia.org/img.png"), {
        allowedHostnames: ["*.checkmedia.org"],
      }),
    ).not.toThrow();
  });
});

describe("assertResolvesToPublicAddresses", () => {
  it("accepts hosts resolving only to public addresses", async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL("https://example.com"), async () => [
        { address: "93.184.216.34", family: 4 },
      ]),
    ).resolves.toBeUndefined();
  });

  it("rejects hosts resolving to any blocked address", async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL("https://example.com"), async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.1", family: 4 },
      ]),
    ).rejects.toThrow(/blocked address/);
  });

  it("rejects hosts that fail to resolve", async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL("https://example.com"), async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toThrow(/Failed to resolve/);
  });
});

describe("parseHostnameAllowlist", () => {
  it("splits and trims comma-separated entries", () => {
    expect(parseHostnameAllowlist(" a.com , *.b.org ,, ")).toEqual([
      "a.com",
      "*.b.org",
    ]);
    expect(parseHostnameAllowlist(undefined)).toEqual([]);
  });
});
