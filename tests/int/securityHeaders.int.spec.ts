import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/lib/security/headers.mjs";

const getDirective = (csp: string, name: string) =>
  csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));

describe("buildContentSecurityPolicy", () => {
  const prodCsp = buildContentSecurityPolicy({ isDev: false });

  it("restricts framing to self and approved embed providers only", () => {
    expect(getDirective(prodCsp, "frame-src")).toBe(
      "frame-src 'self' https://airtable.com",
    );
  });

  it("restricts form submission to self and approved newsletter providers", () => {
    expect(getDirective(prodCsp, "form-action")).toBe(
      "form-action 'self' https://*.list-manage.com",
    );
  });

  it("locks down baseline directives", () => {
    expect(getDirective(prodCsp, "default-src")).toBe("default-src 'self'");
    expect(getDirective(prodCsp, "object-src")).toBe("object-src 'none'");
    expect(getDirective(prodCsp, "base-uri")).toBe("base-uri 'self'");
    expect(getDirective(prodCsp, "frame-ancestors")).toBe(
      "frame-ancestors 'self'",
    );
  });

  it("supports MUI/Emotion inline styles and Sentry ingest", () => {
    expect(getDirective(prodCsp, "style-src")).toContain("'unsafe-inline'");
    expect(getDirective(prodCsp, "connect-src")).toContain(
      "https://*.sentry.io",
    );
  });

  it("only allows eval and websockets in development", () => {
    expect(getDirective(prodCsp, "script-src")).not.toContain("'unsafe-eval'");
    expect(getDirective(prodCsp, "connect-src")).not.toContain("ws:");

    const devCsp = buildContentSecurityPolicy({ isDev: true });
    expect(getDirective(devCsp, "script-src")).toContain("'unsafe-eval'");
    expect(getDirective(devCsp, "connect-src")).toContain("ws:");
  });
});

describe("buildSecurityHeaders", () => {
  const prodHeaders = buildSecurityHeaders({ isDev: false });
  const headerMap = new Map(prodHeaders.map(({ key, value }) => [key, value]));

  it("includes the full baseline header set in production", () => {
    expect(headerMap.get("Content-Security-Policy")).toBeTruthy();
    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerMap.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=");
  });

  it("omits HSTS in development", () => {
    const devKeys = buildSecurityHeaders({ isDev: true }).map(
      ({ key }) => key,
    );
    expect(devKeys).not.toContain("Strict-Transport-Security");
    expect(devKeys).toContain("Content-Security-Policy");
  });
});
