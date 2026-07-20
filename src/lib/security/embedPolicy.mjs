/**
 * Single source of truth for the third-party embed trust boundary.
 *
 * Plain ESM (`.mjs`) so it can be imported both by `next.config.mjs`
 * (which cannot load TypeScript) and by application/TypeScript code,
 * keeping the CSP and the runtime embed validation in lockstep.
 *
 * To approve a new embed provider, add an entry here and document the
 * decision in docs/security/embeds-and-csp.md.
 */

/**
 * Providers whose pages may be embedded in an <iframe> (promise-update
 * dialog). `hosts` entries are exact hostnames, or `*.example.com` to
 * allow any subdomain of example.com (but not example.com itself).
 * `cspSource` feeds the `frame-src` CSP directive.
 */
export const IFRAME_EMBED_PROVIDERS = [
  {
    provider: "airtable",
    hosts: ["airtable.com"],
    cspSource: "https://airtable.com",
  },
];

/**
 * Origins that embedded/legacy newsletter forms may submit to.
 * `cspSource` feeds the `form-action` CSP directive.
 */
export const FORM_ACTION_PROVIDERS = [
  {
    provider: "mailchimp",
    hosts: ["*.list-manage.com"],
    cspSource: "https://*.list-manage.com",
  },
];

/**
 * @param {string} hostname lowercase hostname to test
 * @param {string[]} patterns exact hostnames or `*.suffix` wildcards
 */
const hostMatches = (hostname, patterns) =>
  patterns.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".list-manage.com"
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }
    return hostname === pattern;
  });

/**
 * @param {unknown} value candidate URL
 * @param {{ hosts: string[] }[]} providers
 * @returns {boolean} true when value is an https URL on an approved host
 */
const isAllowedEmbedUrl = (value, providers) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") {
    return false;
  }
  const hostname = url.hostname.toLowerCase();
  return providers.some(({ hosts }) => hostMatches(hostname, hosts));
};

/** @param {unknown} value */
export const isAllowedIframeUrl = (value) =>
  isAllowedEmbedUrl(value, IFRAME_EMBED_PROVIDERS);

/** @param {unknown} value */
export const isAllowedFormActionUrl = (value) =>
  isAllowedEmbedUrl(value, FORM_ACTION_PROVIDERS);

export const iframeCspSources = IFRAME_EMBED_PROVIDERS.map(
  ({ cspSource }) => cspSource
);

export const formActionCspSources = FORM_ACTION_PROVIDERS.map(
  ({ cspSource }) => cspSource
);
