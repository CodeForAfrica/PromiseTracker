# 8. Security and operations

Most of this carries over from v2, which did the work well and documented it in
`docs/remote-file-ingestion.md` and `docs/security/embeds-and-csp.md`. Where v3 changes
something, it says so.

## 8.1 Authentication and authorization

| Surface | Auth |
|---|---|
| Public site and public API | None |
| Embed routes | None |
| Admin | Payload session |
| Plugin inbound routes | A per-route shared secret, compared in constant time |
| Internal job trigger | Payload session |

[§4.5](04-governance.md#45-roles) holds the roles and the permission matrix. Collection access
functions enforce them, and field-level access guards `recordStatus`, `verification.*` and every
plugin-owned field.

Superdesk needs a real user account rather than an API client
([§6.2](06-plugins.md#authentication)). Treat it as a privileged credential and rotate it on the
same schedule as the rest.

## 8.2 Input validation

A schema validates every piece of external data before use: webhook payloads, API responses,
import rows, form submissions. Nothing reaches a Payload write unvalidated.

Inbound push handlers follow a fixed order.

1. Verify the signature before parsing the body.
2. Check the idempotency key against what has already been processed.
3. Validate the payload shape.
4. Only then touch the database.

## 8.3 Secrets

| Secret | Where | Rotation |
|---|---|---|
| `PAYLOAD_SECRET`, `DATABASE_URI` | Environment | Annually |
| S3 credentials | Environment | Annually |
| Plugin API keys and tokens | Settings global, encrypted at rest | On offboarding |
| Inbound webhook secrets | Environment | Every 6 months |

Plugin credentials live in the database because they change per deployment without a redeploy.
`src/fields/encryptedSecret.ts` carries over unchanged. It encrypts on write with a version
prefix, returns a mask to non-local callers, decrypts only for the Local API, and preserves the
stored value when the mask is resubmitted, which is what stops a careless admin save from wiping
a key.

Never logged: keys, tokens, passwords, submitter email addresses, raw IP addresses.

## 8.4 Outbound requests (SSRF)

The policy is unchanged from v2 and is the strongest part of its security posture.

By default the backend makes no outbound request to a user-supplied URL. `Document.sourceUrl`,
`Evidence.url` and `Submission.evidenceUrl` are attribution only. They are stored, displayed and
linked, never fetched.

The one exception is the `url` source connector, where an editor has explicitly asked for a URL
to be retrieved. It runs through the existing guard in `src/utils/ssrf.ts` and
`src/utils/files.ts`.

- HTTPS only. Every other scheme is rejected.
- The hostname resolves before the request, and the request is rejected if any resolved address
  is private (`10/8`, `172.16/12`, `192.168/16`), loopback, link-local including the
  `169.254.169.254` cloud-metadata endpoint, CGNAT, multicast or reserved, along with the IPv6
  equivalents `::1`, `fe80::/10`, `fc00::/7`, IPv4-mapped, NAT64 and 6to4. IP-literal URLs are
  checked directly.
- Redirects are followed manually, every hop is re-validated before it is dialled, and there is
  a hop limit.
- Timeouts apply per hop and in total. A byte cap is enforced from `Content-Length` and again
  while streaming, under a global concurrency limit.
- MIME validation plus magic-byte signature verification. SVG uploads are rejected outright.

One residual risk, stated plainly. DNS is validated immediately before each request, so a
malicious authoritative server with a 0-TTL record could attempt a rebinding race in the window
between validation and connection. The hosting environment's egress policy is the mitigation.

## 8.5 Uploads

- The extension and the declared MIME type must both be allowed and must agree with each other,
  and magic bytes must then match the claimed type.
- Size caps per kind.
- A rate limit and concurrency gate per client.
- A rolling daily byte budget, which bounds storage and bandwidth cost.
- Files are stored by content hash, so identical uploads deduplicate.

## 8.6 Public endpoint protection

| Endpoint | Protection |
|---|---|
| Submission form | Captcha, per-IP rate limit, honeypot field, and a salted IP hash for abuse handling |
| Public API | Per-IP rate limit, CDN cache, pagination caps |
| Embeds | No cookies, no state, CDN-cached |
| Inbound plugin routes | Shared secret, per-IP rate limit, idempotency cache |
| Search | Query length cap, rate limit |

Raw IP addresses are never stored. Submissions keep a salted hash, which is enough to detect
abuse patterns and not enough to identify a contributor.

## 8.7 Content security policy

The main site keeps a strict policy, including `frame-ancestors 'self'`.

`/embed/*` is the deliberate exception, with `frame-ancestors *` on those routes alone, serving
pages that carry no cookies, no authentication and no state. The split keeps the admin and the
main site un-embeddable while letting partners syndicate
([§7.6](07-public-site.md#76-distribution)).

Extracted text and any HTML from an external source is sanitised before storage, with an
allowlist of tags and no attributes.

## 8.8 Observability

Logs are structured JSON. Every entry carries level, message, timestamp, source such as
`task.extractText` or `plugin.superdesk.push`, and the ids needed to trace one document end to
end: `documentId`, `claimId`, `countryId`, `taskId`, `workflowRunId`, `plugin`. Errors carry
code, stack and metadata, and any operation over 100ms carries a duration.

Three rules. Log to console and to Sentry. Log success as well as failure, because success logs
are what make anomaly detection possible. Never log a secret.

Metrics in Sentry: documents processed by stage, extraction candidates proposed and accepted,
verification round-trip time, cascade job duration, push deliveries received and rejected,
public API request rate, cache hit ratio.

Health lives at `/api/health`.

```jsonc
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "…",
  "plugins": { "enabled": ["core","tika","ai","superdesk"],
               "ports": { "verification": "superdesk", "extractors": ["plaintext","tika"] } },
  "services": {
    "database":  { "healthy": true, "latencyMs": 4 },
    "storage":   { "healthy": true, "latencyMs": 22 },
    "tika":      { "healthy": true, "latencyMs": 31 },
    "llm":       { "healthy": true, "latencyMs": 180 },
    "superdesk": { "healthy": true, "latencyMs": 95 }
  }
}
```

Only enabled plugins appear. Two changes from v2 are worth noting.

The response reports the resolved plugin and port configuration, which is the first thing anyone
wants when a deployment misbehaves.

The public read path has no external dependency. v2 makes Tika an unconditional readiness
dependency, so a Tika outage marks the whole application unready even though no public page
touches it. In v3, `/api/health/ready` covers only the database and storage, while extractors,
AI and the verification provider report into `/api/health` and degrade the pipeline rather than
the site.

## 8.9 Alerting

| Condition | Route |
|---|---|
| Pipeline success rate below 90% for 15 min | Slack |
| A dependency unhealthy for over 5 min | PagerDuty |
| Error rate above 5% for 10 min | Slack |
| Push signature failures spike | Slack, since someone is probing or a secret rotated badly |
| Content API empty for 3 consecutive polls | Slack, since a subscriber or product misconfiguration is likely ([§6.2](06-plugins.md#polling-precisely)) |
| AI credits exhausted | Slack, plus health `degraded` |
| Database p95 over 500ms | Slack warning |

Editors are never paged for something only an SRE can fix. A failure an editor can fix, such as
a corrupt upload or a dead link, surfaces in the admin on the record itself.

## 8.10 Configuration validation

At boot, before serving:

1. Core environment variables present.
2. `PT_PLUGINS` resolves, dependencies satisfied, no cycles.
3. Every exclusive port has exactly one implementation.
4. `requiredEnv` present for each enabled plugin.
5. Database and storage reachable.
6. Each enabled plugin's `validateSettings()` runs. Superdesk checks its profile, vocabulary,
   desk and stage ids against the live instance.

Any failure prints every problem at once and exits non-zero. A half-configured deployment that
starts and then fails per request is worse than one that does not start.

## 8.11 Deployment

- Node 24, pnpm, a single container, with Tika in its own container when enabled.
- MongoDB and S3 external.
- Zero-downtime rolling deploys, with the health check gating readiness.
- Schema migrations are versioned, reversible where possible, and run before the new version
  serves.
- Rollback triggers: error rate over 10% for 5 minutes, broken critical functionality, data
  corruption.

Backups. The database gets a daily full backup with 30-day retention on versioned object
storage. Media gets versioning plus cross-region replication. RTO is 4 hours and RPO is 24
hours. Restores are tested quarterly, because an untested backup is a hypothesis.

## 8.12 Data retention

| Data | Retention |
|---|---|
| Claims, updates, actors, documents | Indefinite, archived, never auto-deleted |
| Extraction `rawResponse` | 90 days, then pruned. Candidates and decisions are kept |
| Rejected and spam submissions | 180 days |
| Submitter contact details | Deleted on request, and never published without `consentToAttribute` |
| Completed jobs | Deleted on completion |
| Failed jobs | 7 days |
| Logs | Per the Sentry plan |

## 8.13 Testing

| Layer | Share | Covers |
|---|---|---|
| Unit | around 80% | Pure functions: status computation, slug rules, quote verification, import mapping, retry and backoff |
| Integration | around 15% | Tasks with mocked externals, route handlers, access control, the cascade, plugin resolution |
| End-to-end | around 5% | Upload, extract, review, verify, publish, public page; and submission, moderation, timeline |

Coverage targets are 70% overall, 85% on the pipeline, governance and plugin resolution, and 90%
on utilities.

Every plugin is tested both enabled and disabled, and a disabled plugin must return the config
byte-identical to what it received. Core is tested entirely on its own, with no credentials for
anything. If that suite needs an API key, D4 has been violated and the build should fail.

The v2 security suite carries over as the regression floor:
`tests/int/{ssrf,fileSignature,requestGuards,securityHeaders,privilegedAccess,publicApiAccess,publicRoutes}.int.spec.ts`.
