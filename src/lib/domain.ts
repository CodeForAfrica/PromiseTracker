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

const appUrlHref = (() => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    const parsed = new URL(appUrl);
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
})();

export const getDomain = async () => {
  const headers = await getHeaders();
  const forwardedHost = headers.get("x-forwarded-host");
  const hostHeader = headers.get("host");
  // x-forwarded-host can be a comma-separated list; pick the first value.
  const host = forwardedHost?.split(",")[0]?.trim() || hostHeader;

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
  const appRootLabel = appHost?.hostname?.split(".")[0] ?? null;

  if (hostname) {
    const segments = normalizedHostname.split(".").filter(Boolean);
    const tenantCandidate = segments.length > 2 ? segments[0] : null;
    const looksLikeTenant =
      tenantCandidate !== null &&
      tenantCandidate !== "www" &&
      tenantCandidate !== appRootLabel &&
      tenantCandidate.length <= 20 &&
      /^[a-z0-9-]+$/.test(tenantCandidate) &&
      !tenantCandidate.includes("promisetracker");

    if (looksLikeTenant) {
      subdomain = tenantCandidate;
      baseDomain = `${segments.slice(1).join(".")}${port || appHost?.port || ""}`;
    } else {
      baseDomain = `${hostname}${port || appHost?.port || ""}`;
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
  const tenantSelectionHref =
    baseDomain && !isLocalhost
      ? `${protocol}://${baseDomain}`
      : baseDomain
        ? `${protocol}://${baseDomain}`
        : appUrlHref ?? "/";

  return {
    isLocalhost,
    baseDomain,
    port,
    subdomain,
    hostname,
    tenantSelectionHref,
  };
};
