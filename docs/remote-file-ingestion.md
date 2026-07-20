# Remote-file ingestion and inbound endpoint hardening

This document describes the safety boundary around remote downloads (Meedan
Check images, Airtable document URLs) and inbound state-changing endpoints
(`/api/meedan-sync`, `/api/airtable-upload`), plus the quotas that bound
their resource usage.

## Remote downloads (`downloadFile` in `src/utils/files.ts`)

All remote downloads share these controls:

- **HTTPS only.** Plain `http:` (and any other scheme) is rejected.
- **SSRF address filtering.** The hostname is resolved before the request is
  made and the download is rejected when any resolved address is private
  (`10/8`, `172.16/12`, `192.168/16`), loopback, link-local (including the
  `169.254.169.254` cloud-metadata endpoint), CGNAT, multicast, reserved, or
  a blocked-range IPv6 equivalent (`::1`, `fe80::/10`, `fc00::/7`,
  IPv4-mapped, NAT64, 6to4). IP-literal URLs are checked directly. See
  `src/utils/ssrf.ts`.
- **Redirect bounding.** Redirects are followed manually. Every redirect
  destination is re-validated (HTTPS + address filtering + DNS check) before
  it is dialled. At most `DOWNLOAD_MAX_REDIRECTS` (default **3**) hops.
- **Timeouts.** Response headers must arrive within
  `DOWNLOAD_RESPONSE_TIMEOUT_MS` (default **30s**) per hop; the whole
  download must finish within `DOWNLOAD_TOTAL_TIMEOUT_MS` (default **5min**).
- **Byte limit.** Enforced from `Content-Length` when present and again
  while streaming (`MAX_DOWNLOAD_BYTES`, default **1GB**; Meedan webhook
  images use `MEEDAN_MAX_IMAGE_BYTES`, default **10MB**).
- **Concurrency.** At most `MAX_CONCURRENT_DOWNLOADS` (default **4**)
  simultaneous downloads per app instance; the rest queue.
- **Content validation.** Callers pass `allowedMimeTypes`; with
  `verifySignature: true` the downloaded file's magic bytes must match its
  `Content-Type` (see `src/utils/fileSignature.ts`).

### Meedan-specific rules

Meedan image URLs (webhook `/api/meedan-sync` and the `syncMeedanPromises`
workflow) additionally require the hostname to match the allowlist in
`MEEDAN_ALLOWED_IMAGE_HOSTS` (comma-separated hostnames or `*.suffix`
wildcards; default `checkmedia.org,*.checkmedia.org`). SVG is not accepted
as an image type.

Airtable document downloads (`downloadDocuments` task) accept any public
HTTPS host (editors legitimately link documents from arbitrary sites) but
get all of the shared controls above. Note that plain-HTTP document links
that may previously have worked are now rejected; the task marks the
Airtable row as failed so editors can fix the link.

One internal exception: the `extractDocuments` task re-fetches the app's
*own* media from `NEXT_PUBLIC_APP_URL` (which is `http://localhost` in
development). That app-built URL uses `allowPrivateAddresses`/HTTP
explicitly; the option must never be used for URLs containing external
input.

### Residual risk

DNS is validated at lookup time immediately before each request; a
malicious authoritative DNS server with a 0-TTL record could still attempt
a rebinding race between validation and connection. The hostname allowlist
for Meedan downloads and the network egress policy of the hosting
environment are the mitigations for that residual window.

## Uploads (`/api/airtable-upload`)

- **Authentication.** `Bearer` token compared in constant time
  (`AIRTABLE_UPLOAD_TOKEN`).
- **Type validation.** The file extension and the multipart MIME type must
  both be allowed for the declared upload kind *and* agree with each other;
  the file's magic bytes must then match the claimed type. SVG uploads are
  rejected entirely.
- **Size quotas.** `AIRTABLE_UPLOAD_MAX_IMAGE_BYTES` (default **12MB**) and
  `AIRTABLE_UPLOAD_MAX_DOCUMENT_BYTES` (default **1GB**), enforced while
  streaming.
- **Rate limit.** `AIRTABLE_UPLOAD_RATE_LIMIT_PER_MINUTE` requests per
  client IP per minute (default **30**).
- **Concurrency.** At most `AIRTABLE_UPLOAD_MAX_CONCURRENT` uploads
  processed simultaneously per instance (default **4**).
- **Storage/cost budget.** Accepted upload bytes are capped at
  `AIRTABLE_UPLOAD_DAILY_MAX_BYTES` per rolling 24h window per instance
  (default **5GB**). This bounds storage growth and S3/bandwidth cost from
  a leaked token; raise it deliberately if legitimate volume grows.

## Meedan webhook (`/api/meedan-sync`)

- **Authentication.** `WEBHOOK_SECRET_KEY` compared in constant time.
- **Rate limit.** `MEEDAN_SYNC_RATE_LIMIT_PER_MINUTE` requests per client
  IP per minute (default **60**).
- **Replay / duplicate delivery protection.** Each request body is
  fingerprinted (SHA-256). Within
  `MEEDAN_SYNC_IDEMPOTENCY_TTL_MS` (default **10min**):
  - a duplicate of a completed request replays the recorded response
    (marked `"replayed": true`) without re-processing;
  - a duplicate of an in-flight request gets `409 Conflict`;
  - `5xx` outcomes are not recorded, so genuine retries re-process.

## Media serving

- SVG is no longer accepted from any ingestion path (uploads, Meedan
  images).
- Locally served uploads (`/api/media/file/*`) are sent with
  `X-Content-Type-Options: nosniff` and a sandboxing
  `Content-Security-Policy` so stored content cannot execute scripts on the
  application origin (`next.config.mjs`).
- For full origin isolation in production, serve media from the S3/CDN
  origin (already supported via `@payloadcms/storage-s3`) rather than the
  app origin.

## Deployment note on in-memory guards

Rate limits, idempotency records, concurrency gates, and byte budgets are
kept in process memory (`src/utils/requestGuards.ts`). They are enforced
**per app instance** and reset on restart. With `N` replicas the effective
global quota is up to `N ×` the configured value. If the deployment scales
beyond a small number of replicas, back these guards with a shared store
(e.g. Redis) — the call sites are already funnelled through
`requestGuards.ts`.
