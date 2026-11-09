# 6. Plugins

One section per adapter. Each states which ports it implements, which fields it owns, what it
injects, what it exposes, and how it fails.

## 6.1 plugin-core

Implements `VerificationProvider:native`, `SourceConnector:upload`, `SourceConnector:url`,
`ContentExtractor:plaintext`, `StructuredImporter:csv` and `StructuredImporter:xlsx`.

Owns every collection and global in [§3](03-data-model.md).

Core is the baseline, and the baseline is a complete product (D4). It is what CI runs against,
what a new contributor gets from `pnpm dev` with no credentials, and the fallback when an
integration is retired.

### verification:native

Review inside the Payload admin. A reviewer opens a claim and sees the statement, the source
document with the quote highlighted, the actor and the extraction provenance, then sets
`verification.verdict` with a rationale. A saved view called "Awaiting verification" is the
queue.

```ts
const nativeVerification: VerificationProvider = {
  id: 'native',
  async submit() { return null },        // nothing leaves the system
  async pull() { return [] },            // nothing comes back
  async health() { return { healthy: true, latencyMs: 0 } },
}
```

The null implementation is the point. With `native` selected, `verification.verdict` is an
ordinary editable field and no synchronisation exists.

## 6.2 plugin-superdesk (D1)

Implements `VerificationProvider:superdesk`. Owns `verification.verdict`,
`verification.verifiedAt` and `verification.rationale` on `claims`, and injects a read-only
`superdesk` group there
([§2.5](02-architecture.md#25-ownership-and-single-source-of-truth-d5)).

Superdesk Core is Sourcefabric's newsroom production system. It has no native fact-check or
claim model, so the adapter builds one out of a content profile and custom vocabularies. That
is the idiomatic way to extend Superdesk, but the newsroom has to configure its instance before
the integration can work, and several details below are instance-specific.

> Everything marked **CONFIRM** must be checked against the actual instance. Superdesk is
> mid-way through an async rewrite, and its published changelog stops at 2.4.5 in 2022. Pin the
> version in deployment configuration and re-verify.

### Superdesk's three APIs

| API | Prefix | Methods | Use |
|---|---|---|---|
| Internal | `/api` (`URL_PREFIX`) | full CRUD | The only write path. Creating claim items, patching, publishing |
| Production API | `/prodapi/v1` (`PRODAPI_URL_PREFIX`) | GET only | Reading items in any state, including unpublished |
| Content API | deployment-specific | GET only | Published items, NINJS-shaped |

**CONFIRM** the Content API prefix. It derives from `CONTENTAPI_URL`, and Sourcefabric's own
compose file yields `/capi/items` while other deployments yield `/v1/items`. Do not hardcode
`/v1`. Confirm too that the Production API is deployed at all, since it is a separate process
and many installations do not run it.

### Authentication

| API | Mechanism |
|---|---|
| Internal | `POST /api/auth_db` with service-account credentials returns a session token, sent as `Authorization: Basic base64("<token>:")`. Sessions expire after `SESSION_EXPIRY_MINUTES`, default 240, and the adapter re-authenticates on 401 |
| Production API | OAuth2 client credentials for a JWT. `POST /api/auth_server/token` with `grant_type=client_credentials`, then `Authorization: Bearer <jwt>`, scope `ARCHIVE_READ`. Registered server-side with `manage.py auth_server:register_client` |
| Content API | A subscriber token, the `_id` of a `subscriber_token` document created via `POST /api/subscriber_token` |

A service user is required. The auth server grants read-only scopes and has no write scope, so
creating items needs a real Superdesk user account with the `archive` privilege. Treat its
credentials as a privileged secret ([§8](08-security-ops.md)), scope the account to the
fact-check desk, and name it recognisably, such as `promisetracker-bot`, so its edits are
attributable in Superdesk's own history.

### Modelling a claim in Superdesk

A content item is a flat JSON document close to IPTC NINJS. The adapter uses:

| PromiseTracker | Superdesk | How |
|---|---|---|
| Claim identity | `guid` | Superdesk-generated, stored back as `superdesk.guid` |
| `title` | `headline` | |
| `statement` | `body_html` | The verbatim quote in a blockquote, plus context |
| `summary` | `abstract` | |
| `type` | `subject[]` with `scheme: 'claim_type'` | Custom vocabulary |
| `category` | `subject[]` with `scheme: 'claim_category'` | Custom vocabulary |
| `verification.verdict` | `subject[]` with `scheme: 'verdict'` | Custom vocabulary. **CONFIRM** the scheme id |
| `verification.rationale` | `body_html` of the published fact-check | |
| Claim id, as a back-reference | `extra.promisetracker_id` | Extra field, `field_type: 'text'` |
| Claim URL | `extra.promisetracker_url` | Extra field |
| Language | `language` | |
| Item kind | `profile` | A content profile such as `fact_check`. **CONFIRM** the id |

The verdict is a vocabulary rather than a text field because Superdesk's two extension
mechanisms behave differently.

A custom vocabulary with `field_type: null` plus a `service` puts the selected value into the
item's `subject` array as `{ qcode, name, scheme }`. It is a controlled list, it survives into
NINJS, and it is queryable in Elasticsearch.

A vocabulary with `field_type` set becomes an extra field, stored at `extra.<cv_id>`. The
`extra` dict is mapped `dynamic: false` in Elasticsearch, so filtering on `extra.*` may not work
at all without a mapping change on the instance.

So anything the adapter needs to query goes in `subject` with a scheme, and anything it only
needs to carry goes in `extra`. The PromiseTracker id is carried and never queried on the
Superdesk side, because the adapter matches on `guid` locally.

**CONFIRM** the vocabulary ids, their `qcode` values, the content profile id, and the desk and
stage ids. The adapter validates all of these at boot and refuses to start on a mismatch, rather
than silently writing items nobody sees.

### Outbound: creating a claim for review

```http
POST /api/archive
Authorization: Basic base64("<session-token>:")
Content-Type: application/json

{
  "type": "text",
  "profile": "<fact_check profile id>",
  "headline": "Ruto: 'We will build 200 new health centres by 2027'",
  "body_html": "<blockquote>…verbatim statement…</blockquote><p>Source: 2022 manifesto, p.41</p>",
  "abstract": "…",
  "language": "en",
  "subject": [
    { "qcode": "unverified",       "name": "Unverified",       "scheme": "verdict" },
    { "qcode": "campaign-promise", "name": "Campaign promise", "scheme": "claim_type" },
    { "qcode": "health",           "name": "Health",           "scheme": "claim_category" }
  ],
  "extra": {
    "promisetracker_id":  "6745abc…",
    "promisetracker_url": "https://promisetracker.org/ke/promises/200-health-centres"
  },
  "task": { "desk": "<desk id>", "stage": "<stage id>" }
}
```

Superdesk fills in `guid`, `_id`, `family_id`, `unique_id`, `version` and `original_creator`,
and sets `state: 'draft'`.

`task.desk` and `task.stage` are not optional in practice. Without them the item lands in the
service account's personal workspace and no fact-checker will ever see it. Both ids are
configuration, validated at boot.

Post to `/api/archive`, not `ingest`. Archive puts the item inside the newsroom at
`state: 'draft'`, which is what an AI-extracted promise awaiting review means. The `ingest`
route is the alternative when the newsroom wants its own routing rules, but a fetched ingest
item gets a new guid, which breaks the stable identifier the adapter depends on.

### Inbound: receiving verdicts

Two paths, and the adapter runs both.

The primary path is an HTTP push on publish. Configure a Superdesk subscriber with an
`http_push` destination.

```json
{
  "name": "PromiseTracker",
  "is_active": true,
  "subscriber_type": "all",
  "destinations": [{
    "name": "promisetracker",
    "format": "ninjs",
    "delivery_type": "http_push",
    "config": {
      "resource_url": "https://promisetracker.org/api/plugins/superdesk/items",
      "assets_url":   "https://promisetracker.org/api/plugins/superdesk/assets",
      "secret_token": "<shared secret>"
    }
  }],
  "products": ["<product id>"]
}
```

Superdesk `POST`s the NINJS item and signs it.

```
x-superdesk-signature: sha1=<hex HMAC-SHA1(secret_token, raw_body)>
```

The handler must verify this signature in constant time before parsing. HMAC-SHA1 is weak by
modern standards but it is what Superdesk implements, so compensate with the secret's entropy
and treat the endpoint as untrusted input regardless.

The secondary path is a reconciliation poll. Every 15 minutes a job pulls items changed since
the last cursor and reconciles. Pushes are not guaranteed, since a deploy, a network blip or a
disabled subscriber loses them silently. This is the same webhook-plus-safety-poll argument the
v2 reference architecture made for Airtable.

```http
GET {contentApiPrefix}/items
      ?filter={"range":{"versioncreated":{"gte":"2026-11-06T10:00:00+0000"}}}
      &sort=[("versioncreated",1)]
      &max_results=200
Authorization: Basic base64("<subscriber-token>:")
```

### Polling, precisely

The Content API is unusually constrained, and getting this wrong produces a sync that looks
like it works and quietly misses items.

- `start_date` and `end_date` are date-only (`YYYY-MM-DD`), inclusive, and cannot be in the
  future, which makes them useless for a 15-minute window. Use the `filter` parameter with a raw
  Elasticsearch range on `versioncreated` instead.
- With no dates given, the default window is the last 7 days. Anything older is invisible, so a
  backfill job must walk date ranges explicitly.
- There are no ETags. `_etag`, `_created` and `_updated` are stripped from Content API
  responses, so conditional requests are unavailable and the sync cursor must be
  `versioncreated`.
- Query parameters are a strict whitelist. Anything outside it returns an error rather than an
  ignored parameter.
- Pagination defaults to 500 and caps at 1,000.
- Overlap the window by 10 minutes. `versioncreated` is server-side UTC and Elasticsearch has a
  refresh interval, so an item can become visible after a poll whose window should have included
  it.
- Store the cursor as the maximum `versioncreated` actually observed, never wall-clock time.
- Date formats differ between APIs. The internal and Content APIs use `+0000`, and the
  Production API defaults to RFC 3339 `+00:00`. Parse both.
- Visibility is subscriber-scoped. The Content API filters by a `subscribers` array written at
  publish time, so if PromiseTracker's subscriber matches no product the API returns `200` with
  an empty list. That is a silent no-data failure, not an error. Test it explicitly, and treat a
  sustained empty result as a health-check failure rather than as nothing new.

### Item state mapping

Superdesk reuses one `guid` across corrections and kills, with a new `version` and a new
`versioncreated`. There is no delete.

| Superdesk `state` | PromiseTracker effect |
|---|---|
| `draft`, `in_progress`, `submitted` | In review. No change to the claim |
| `published`, `corrected` | Apply the verdict and rationale, and set `verifiedAt` |
| `killed`, `recalled`, `takedown` | Depublish: `verification.verdict` to `unverified`, `recordStatus` to `hold`, and notify an editor |
| `unpublished` | Same as above |
| `spiked` | `recordStatus` to `archived` |
| `scheduled`, `being_corrected`, `correction` | No change. Wait for the terminal state |

Note the exact strings. It is `in_progress`, not `progress`, and `pubstatus` `withheld` is
represented by a constant named `HOLD`. These are easy mismatches to ship.

Dedupe on `(guid, version)`. A correction republishes the same `guid` with a higher version and
that is new information, while the same `(guid, version)` twice is not. The publish queue
retries and does not guarantee ordering, so the handler must also tolerate out-of-order arrival
and apply only when the incoming version is greater than the stored one.

The adapter both creates items and receives them, so it guards against loops. Every inbound item
carrying an `extra.promisetracker_id` the system already owns is matched to that claim and never
re-created. An inbound item with no `promisetracker_id` is ignored by default, and importing
newsroom-originated claims is a separate behaviour that has to be enabled.

### What is not used

- Websocket notifications on port 5100 carry only resource ids and changed field names, no
  content, and have no authentication. They are an internal component, normally not exposed, and
  not a dependency.
- `POST /api/webhook` only re-triggers an ingest provider poll. It does not receive content.
- Content-list webhooks exist on `develop` but are not in the published documentation.
  **CONFIRM** before designing around them.

### Failure behaviour

| Failure | Behaviour |
|---|---|
| Boot with an invalid profile, vocabulary, desk or stage id | Refuse to start, naming the bad id |
| Session expired (401) on write | Re-authenticate once, retry once, then fail the task |
| Push signature invalid | Return `401`, log at `warn` with the source IP, do not parse the body |
| Push for an unknown `guid` | Return `200` so Superdesk stops retrying, and record for reconciliation |
| Superdesk unreachable | Circuit breaker opens, claims queue locally, health check reports `degraded` |
| Content API empty for 3 consecutive polls | Health check `degraded`, since a subscriber or product misconfiguration is likely |

Nothing about PromiseTracker stops working when Superdesk is down. Claims are still created,
extracted, edited and published. Only new verdicts stop arriving. That is the whole point of the
port.

## 6.3 plugin-check, specified but not built (D6)

Meedan Check is documented here as a second implementation of `VerificationProvider`, to show
the interface is not Superdesk-shaped. It is not built in v3.

| Port method | Check equivalent |
|---|---|
| `submit` | `createProjectMedia` GraphQL mutation, `media_type: "Claim"` |
| `pull` | `search(query: { report_status: ["published"] })` |
| `receive` | `POST /api/plugins/check/webhook`, `annotation_type: "report_design"` |

Mapping Check onto the same three verdict fields needs no change to the interface, which is the
result worth knowing. The v2 implementation, roughly 2,000 lines across `src/lib/meedan.ts`,
`src/lib/syncMeedanReports.ts`, three tasks, a workflow and a webhook route, is not carried
forward, and with no Check data to migrate the workspace is simply retired
([§9.4](09-launch.md#94-retiring-the-integrations)).

One v2 lesson: `syncMeedanReports` could not recover a promise's political entity or category
from a Check report, so it rebuilt an in-memory index of every `ai-extractions` document on every
run. The port avoids that by keeping the claim in PromiseTracker and letting only the verdict
cross the boundary.

## 6.4 plugin-ai

Implements `LLMProvider` for each configured vendor. Owns the `extractions` collection, the
`extractCandidates` task and the review queue UI. It injects nothing on `documents`, where it
reads `text` and writes `processing.status`.

Adapters wrap the Vercel AI SDK provider factories. The catalogue, model-id resolution and
credential validation come straight from v2's `src/lib/ai/providerCatalog.ts` and
`providerRegistry.ts`, which already do this job behind a hardcoded switch.

```bash
PT_LLM_MODEL=google:gemini-2.5-pro
```

Credentials live in Settings under AI, encrypted. One provider is selected for extraction, and
others may be registered and are available for a future second opinion.

Health is a cheap completion against the selected model at startup and on `/api/health`.
Exhausted credits surface as `degraded` rather than as a flood of failed documents, a failure
mode v2 only discovered through Sentry.

## 6.5 plugin-tika

Implements `ContentExtractor:tika`.

A thin client over a self-hosted Apache Tika server. `docker compose up -d` already provides one
in v2, and the production image bundles Tika 3.2.3.

- Accepts PDF, Word, Excel, PowerPoint, OpenDocument, RTF, EPUB and the rest of Tika's format
  list, which is most of what ingest from docs, Excel, CSV and URLs asks for.
- Returns NFC-normalised text, a page count, and document metadata as editor suggestions.
- Two-minute timeout, circuit breaker, and a participant in `/api/health`.
- Required for the health check only when enabled. In v2, Tika is an unconditional readiness
  dependency, so a Tika outage marks the whole app unready even though the public site never
  touches it. In v3 the public read path never depends on an extractor.

## 6.6 plugin-airtable, optional and not required

Implements `SourceConnector:airtable` and `StructuredImporter:sheets`. Owns nothing in core
unless explicitly enabled to.

Retained as an option for teams still working in Airtable, not as a dependency. The one real
difference from v2 is the direction of authority. With the plugin enabled, Airtable is a source
of documents and actors and may take ownership of those fields, but it is never the work queue
and never the operator console. Processing state lives in `Document.processing.status` and is
visible in the admin whatever else is running.

For most teams the better exit is a one-off structured import
([§5.6](05-pipeline.md#56-structured-import)) rather than a standing sync.

## 6.7 Plugin routes

App Router routes are filesystem entries and cannot be registered at runtime, so plugin routes
follow a convention and are declared in the manifest.

```
src/app/api/plugins/
├── superdesk/
│   ├── items/route.ts      POST, receives pushed NINJS items
│   └── assets/route.ts     GET and POST, media exchange
└── airtable/
    └── webhook/route.ts    POST
```

Every handler's first action is a plugin check. If the plugin is not enabled it returns `503`
immediately, without executing any application logic. The manifest's `routes[]` declares the
path, methods, purpose and the secret each one needs, which is how the integration tests
discover what to exercise instead of hardcoding paths.
