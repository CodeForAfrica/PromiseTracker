# CMS embeds and browser content policies

This document describes the trust boundary between CMS-authored content
and the browser: which third-party embeds are allowed, how they are
constrained, and which security headers every response carries.

The single source of truth for the embed allowlist is
[`src/lib/security/embedPolicy.mjs`](../../src/lib/security/embedPolicy.mjs).
The Content-Security-Policy in
[`src/lib/security/headers.mjs`](../../src/lib/security/headers.mjs) is
built from the same allowlist, so approving a new provider in one place
updates both the runtime validation and the CSP.

## Structured embed configuration

CMS editors configure embeds with structured fields, not raw HTML:

- **Promise updates** (`promise-updates` global): the `formUrl` field
  takes the https URL of the Airtable shared form (e.g.
  `https://airtable.com/embed/app…/shr…`). The legacy `embedCode` field
  still accepts a plain Airtable `<iframe>` snippet, but only the `src`
  URL is ever used — the HTML itself is never rendered — and the URL
  must pass the iframe allowlist. Field-level validation rejects
  scripts, inline event handlers, and non-allowlisted origins at save
  time; `resolveUpdateFormUrl` rejects them again at render time.
- **Newsletter** (site settings → Engagement tab): the `signupUrl`
  field takes the Mailchimp form action URL (e.g.
  `https://<account>.<dc>.list-manage.com/subscribe/post?u=…&id=…`).
  The site renders its own first-party signup form (including
  Mailchimp's anti-bot honeypot field) posting to that URL. The legacy
  `embedCode` field remains as a fallback and is sanitized before
  rendering (see below).

## Allowlisted origins

| Purpose | Provider | Hosts | CSP directive |
| --- | --- | --- | --- |
| Promise-update iframe | Airtable | `airtable.com` (exact) | `frame-src https://airtable.com` |
| Newsletter form action | Mailchimp | `*.list-manage.com` (subdomains only) | `form-action https://*.list-manage.com` |

Rules applied to every embed URL:

- `https:` only; `http:`, `javascript:`, `data:` etc. are rejected.
- Host matching is exact, or suffix-based for `*.` wildcard entries
  (`us1.list-manage.com` matches, `evillist-manage.com` and bare
  `list-manage.com` do not).

To approve a new provider, add it to `embedPolicy.mjs` and record the
decision here.

## Legacy HTML sanitization

Legacy newsletter embed HTML is sanitized server-side with
`sanitize-html` ([`src/lib/embeds/sanitize.ts`](../../src/lib/embeds/sanitize.ts))
before it reaches `dangerouslySetInnerHTML`:

- **Scripts**: `<script>`, `<style>`, `<iframe>` and all other
  non-allowlisted tags are removed.
- **Event handlers**: only an explicit attribute allowlist survives, so
  every `on*` attribute is stripped.
- **Forms**: any `<form>` whose `action` is not on an approved
  newsletter provider is removed entirely (with its children).
  Non-allowlisted `input` types (e.g. `type="image"`) are removed.
- **Unsafe URLs**: only `https:` and `mailto:` schemes are allowed;
  protocol-relative URLs are rejected; links are forced to
  `rel="noopener noreferrer"`.

The promise-update path has no HTML sink at all: only a validated URL
string crosses the server/client boundary.

## Iframe constraints (promise-update dialog)

The update form iframe
([`src/components/ActNowCard/UpdateDialog.tsx`](../../src/components/ActNowCard/UpdateDialog.tsx))
re-validates its `src` against the allowlist before rendering and is
constrained to the minimum capabilities Airtable's shared forms need:

| `sandbox` token | Why it is needed |
| --- | --- |
| `allow-scripts` | The Airtable form is a JavaScript application. |
| `allow-forms` | Submitting the form. |
| `allow-same-origin` | The form needs its own (airtable.com) origin for storage/XHR. Safe because `src` can never be a same-origin URL — only allowlisted third-party hosts pass validation. |
| `allow-popups`, `allow-popups-to-escape-sandbox` | Links inside the form open in a new tab. |

Deliberately **not** granted: `allow-top-navigation`,
`allow-downloads`, `allow-modals`, `allow-pointer-lock`,
`allow-presentation`. The `allow` attribute additionally denies
camera, microphone, geolocation, payment, and fullscreen, and
`referrerpolicy="strict-origin-when-cross-origin"` limits referrer
leakage.

## Security headers

Applied to every route via `headers()` in
[`next.config.mjs`](../../next.config.mjs):

| Header | Value (production) |
| --- | --- |
| `Content-Security-Policy` | See below |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `SAMEORIGIN` (legacy fallback for `frame-ancestors`) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (production only) |

CSP directives and their rationale:

| Directive | Sources | Why |
| --- | --- | --- |
| `default-src` | `'self'` | Deny-by-default baseline. |
| `script-src` | `'self' 'unsafe-inline'` (+ `'unsafe-eval'` in dev) | Next.js bootstrap and Payload Admin inject inline scripts; React Refresh needs eval in development only. |
| `style-src` | `'self' 'unsafe-inline'` | MUI/Emotion inject inline `<style>` tags at runtime. |
| `img-src` / `media-src` | `'self' blob: data: https:` | Tenant media may be served from remote object storage/CDNs configured per deployment. |
| `font-src` | `'self' data:` | Self-hosted fonts via `next/font`. |
| `connect-src` | `'self' https://*.sentry.io` (+ `ws: wss:` in dev) | Payload API and the Sentry `/monitoring` tunnel are same-origin; direct Sentry ingest is the SDK fallback; websockets for HMR in dev. |
| `worker-src` | `'self' blob:` | Sentry session replay / bundled workers. |
| `frame-src` | `'self'` + approved iframe providers | Payload Admin live preview plus the promise-update embed. |
| `form-action` | `'self'` + approved newsletter providers | First-party forms plus Mailchimp signup. |
| `frame-ancestors` | `'self'` | The site must not be framed by other origins. |
| `object-src` | `'none'` | No plugins. |
| `base-uri` | `'self'` | Prevents `<base>` hijacking of relative URLs. |

## Tests

- `tests/int/embeds.int.spec.ts` — allowlist acceptance/rejection,
  legacy-snippet validators, and sanitizer behaviour (scripts, event
  handlers, unsafe URLs, unapproved form actions).
- `tests/int/securityHeaders.int.spec.ts` — CSP directive and header
  baseline assertions.
- `tests/e2e/security.e2e.spec.ts` — response headers on a live
  server, keyboard/screen-reader behaviour of the update dialog
  (labelled `role="dialog"`, focus trapping, Escape, focus
  restoration), sandbox attributes, and refusal to render a
  non-allowlisted embed. Uses the development-only harness at
  `/dev/update-dialog`.
