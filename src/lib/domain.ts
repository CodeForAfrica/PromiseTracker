"use server";
import { headers as getHeaders } from "next/headers";

export const getDomain = async () => {
  const headers = await getHeaders();
  const host = headers.get("host");
  const isLocalhost = host?.includes("localhost") ?? false;

  let baseDomain = host;
  let hostname: string | null = null;
  let port = "";

  if (host) {
    // Extract port if present
    const hostParts = host.split(":");
    if (hostParts.length > 1) {
      port = `:${hostParts[1]}`;
    }

    hostname = hostParts[0] || null;

    // Extract base domain without the leading tenant subdomain
    const domainParts = hostname?.split(".") ?? [];

    if (domainParts.length > 2) {
      // Keep all segments after the tenant label to preserve environment prefixes (e.g. staging.example.com)
      baseDomain = `${domainParts.slice(1).join(".")}${port}`;
    } else if (hostname) {
      baseDomain = `${hostname}${port}`;
    }
  }

  let subdomain: string | null = null;
  if (host) {
    const parts = host.split(".");
    // Only extract subdomain if it's a pattern like api.example.com
    // For example.com, subdomain will remain null
    if (parts.length > 2) {
      subdomain = parts[0];
    }
  }

  const normalizedHost = hostname?.toLowerCase() ?? "";
  const normalizedBaseDomain = baseDomain?.toLowerCase() ?? "";
  const isLocalEnvironment =
    isLocalhost ||
    normalizedHost.includes("localtest") ||
    normalizedHost.startsWith("127.") ||
    normalizedHost === "0.0.0.0" ||
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
