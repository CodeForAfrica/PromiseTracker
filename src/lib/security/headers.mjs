/**
 * Builds the Content-Security-Policy and baseline security headers
 * applied to every response via `headers()` in next.config.mjs.
 *
 * Plain ESM (`.mjs`) so next.config.mjs can import it. The embed
 * origins come from embedPolicy.mjs so the CSP always matches the
 * runtime embed allowlist.
 *
 * Directive rationale (see docs/security/embeds-and-csp.md):
 * - script-src 'unsafe-inline': Next.js bootstrap and Payload Admin
 *   inject inline scripts; nonce-based CSP would require middleware
 *   rewriting which conflicts with the standalone/tunnelled setup.
 *   'unsafe-eval' is added in development only (React Refresh/HMR).
 * - style-src 'unsafe-inline': MUI/Emotion inject inline <style> tags.
 * - img-src/media-src https:: tenant media may be served from remote
 *   object storage / CDNs configured per deployment.
 * - connect-src *.sentry.io: browser SDK fallback when the /monitoring
 *   tunnel route is bypassed; 'self' covers the tunnel and Payload API.
 * - frame-src: only approved embed providers (promise-update dialog)
 *   plus 'self' for Payload Admin live preview.
 * - form-action: 'self' plus approved newsletter providers.
 */

import {
  formActionCspSources,
  iframeCspSources,
} from "./embedPolicy.mjs";

/**
 * @param {{ isDev?: boolean }} [options]
 * @returns {string}
 */
export const buildContentSecurityPolicy = ({ isDev = false } = {}) => {
  const directives = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://*.sentry.io",
      ...(isDev ? ["ws:", "wss:"] : []),
    ],
    "worker-src": ["'self'", "blob:"],
    "media-src": ["'self'", "blob:", "data:", "https:"],
    "frame-src": ["'self'", ...iframeCspSources],
    "form-action": ["'self'", ...formActionCspSources],
    "frame-ancestors": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
};

/**
 * @param {{ isDev?: boolean }} [options]
 * @returns {{ key: string, value: string }[]}
 */
export const buildSecurityHeaders = ({ isDev = false } = {}) => [
  {
    key: "Content-Security-Policy",
    value: buildContentSecurityPolicy({ isDev }),
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Legacy fallback for frame-ancestors 'self'.
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];
