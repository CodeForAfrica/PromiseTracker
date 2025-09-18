"use server";
import { headers as getHeaders } from "next/headers";

export const getDomain = async () => {
  const headers = await getHeaders();
  const host = headers.get("host");
  const isLocalhost = host?.includes("localhost");

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

    // Extract base domain without subdomain
    const domainParts = hostParts[0].split(".");
    if (domainParts.length > 2) {
      // For domains like sub.example.com, get example.com
      baseDomain = `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}${port}`;
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

  return { isLocalhost, baseDomain, port, subdomain, hostname };
};
