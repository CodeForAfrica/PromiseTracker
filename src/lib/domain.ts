"use server";
import { headers as getHeaders } from "next/headers";

// Try to derive a canonical host from NEXT_PUBLIC_APP_URL so we can tell when the
// request matches the root site (e.g. promisetracker-v2.dev.codeforafrica.org)
// versus a tenant subdomain such as ken.promisetracker-v2.dev.codeforafrica.org.
const appHost = (() => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;

  try {
    const parsed = new URL(appUrl);
    return {
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port ? `:${parsed.port}` : "",
    } as const;
  } catch {
    return null;
  }
})();

export const getDomain = async () => {
  const headers = await getHeaders();
  const host = headers.get("host");

  let hostname: string | null = null;
  let port = "";

  if (host) {
    // Split off any port (e.g. localhost:3000) and normalise the hostname.
    const [rawHostname, rawPort] = host.split(":");
    hostname = rawHostname || null;
    if (rawPort) {
      port = `:${rawPort}`;
    }
  }

  const normalizedHostname = hostname?.toLowerCase() ?? "";
  const isLocalhost = normalizedHostname.includes("localhost");

  let baseDomain = host ?? "";
  let subdomain: string | null = null;

  if (hostname) {
    if (appHost) {
      const { hostname: canonicalHost, port: canonicalPort } = appHost;

      if (normalizedHostname === canonicalHost) {
        // Exact match with the configured host (e.g. promisetracker-v2.dev.codeforafrica.org) — keep the root domain.
        baseDomain = `${hostname}${port}`;
      } else if (normalizedHostname.endsWith(`.${canonicalHost}`)) {
        // Host looks like `<tenant>.<canonical>` (e.g. ken.promisetracker-v2.dev.codeforafrica.org) — capture the tenant
        // and force the base domain to the canonical host so generated links stay stable.
        const suffixLength = canonicalHost.length + 1;
        const prefix = normalizedHostname.slice(0, -suffixLength);
        const segments = prefix.split(".").filter(Boolean);
        subdomain = segments.pop() ?? null;
        const effectivePort = canonicalPort || port;
        baseDomain = `${canonicalHost}${effectivePort}`;
      } else {
        // Host does not match our configured base (e.g. unexpected.example.com) — fall back to the raw host.
        baseDomain = `${hostname}${port}`;
        const segments = normalizedHostname.split(".");
        if (segments.length > 2) {
          // Treat the leading label as the tenant when there are 3+ segments.
          subdomain = segments.shift() ?? null;
          baseDomain = `${segments.join(".")}${port}`;
        }
      }
    } else {
      // No configured app host — strip the leading label when the host is a
      // subdomain (e.g. api.localhost) so we still surface a link back to the root tenant selector.
      baseDomain = `${hostname}${port}`;
      const segments = normalizedHostname.split(".");
      if (segments.length > 2) {
        subdomain = segments.shift() ?? null;
        baseDomain = `${segments.join(".")}${port}`;
      }
    }
  }

  const normalizedBaseDomain = baseDomain.toLowerCase();
  const isLocalEnvironment =
    isLocalhost ||
    normalizedHostname.includes("localtest") ||
    normalizedHostname.startsWith("127.") ||
    normalizedHostname === "0.0.0.0" ||
    normalizedBaseDomain.includes("localhost") ||
    normalizedBaseDomain.startsWith("127.") ||
    normalizedBaseDomain === "0.0.0.0";

  const protocol = isLocalEnvironment ? "http" : "https";
  const tenantSelectionHref = baseDomain
    ? `${protocol}://${baseDomain}`
    : "/";

  return {
    isLocalhost,
    baseDomain,
    port,
    subdomain,
    hostname,
    tenantSelectionHref,
  };
};
