import { parseHostnameAllowlist } from "@/utils/ssrf";

/**
 * Shared policy for media downloaded from Meedan Check.
 *
 * SVG is intentionally excluded: it can embed scripts and is not required
 * for report imagery.
 */
export const MEEDAN_ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Meedan Check assets are served from checkmedia.org subdomains by default.
// Override with MEEDAN_ALLOWED_IMAGE_HOSTS (comma-separated hostnames or
// "*.suffix" wildcards) when assets live elsewhere (e.g. an S3 bucket).
const DEFAULT_MEEDAN_IMAGE_HOSTS = ["checkmedia.org", "*.checkmedia.org"];

export const getMeedanAllowedImageHosts = (): string[] => {
  const configured = parseHostnameAllowlist(
    process.env.MEEDAN_ALLOWED_IMAGE_HOSTS,
  );

  return configured.length > 0 ? configured : DEFAULT_MEEDAN_IMAGE_HOSTS;
};
