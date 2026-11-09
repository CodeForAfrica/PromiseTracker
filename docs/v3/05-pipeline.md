# 5. Pipeline

From "a partner emailed us a manifesto" to "it's on the site", and every way in between.

## 5.1 Overview

```
                    ┌─────────────── SOURCE CONNECTORS ───────────────┐
                    │  upload · url · airtable · sheets · feed        │
                    └────────────────────┬────────────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                 unstructured                       structured
              (pdf, docx, html, …)              (csv, xlsx, sheet)
                         │                               │
                         ▼                               ▼
              ┌────────────────────┐          ┌─────────────────────┐
              │ CONTENT EXTRACTOR  │          │ STRUCTURED IMPORTER │
              │ tika · plaintext   │          │ csv · xlsx          │
              │ → Document.text    │          │ map → preview →     │
              └─────────┬──────────┘          │ upsert records      │
                        │                     └──────────┬──────────┘
                        ▼                                │
              ┌────────────────────┐                     │
              │   AI EXTRACTION    │                     │
              │  candidates +      │                     │
              │  quote verification│                     │
              └─────────┬──────────┘                     │
                        │                                │
                        ▼                                │
              ┌────────────────────┐                     │
              │   REVIEW QUEUE     │                     │
              │  accept / reject   │                     │
              └─────────┬──────────┘                     │
                        │                                │
                        ▼                                ▼
                 ┌──────────────────────────────────────────┐
                 │                 CLAIMS                    │
                 └───────────────────┬──────────────────────┘
                                     ▼
                     VERIFICATION  (native admin | Superdesk)
                                     ▼
                       EDITOR sets recordStatus: ready
                                     ▼
                                  PUBLIC
```

The structured path skips text extraction, AI and the review queue. A CSV of promises a partner
already compiled needs no language model to interpret it (D18).

## 5.2 Source connectors

Where content comes from. Each one is a `SourceConnector` adapter
([§2.2](02-architecture.md#22-ports)).

| Connector | Mode | Plugin | What it does |
|---|---|---|---|
| `upload` | manual | core | An editor uploads a file in the admin. Always available |
| `url` | manual | core | An editor pastes a URL. The backend fetches it through the SSRF guard ([§8.4](08-security-ops.md#84-outbound-requests-ssrf)), detects the type and stores the artefact |
| `airtable` | pull | airtable | Polls a base on a schedule. Optional, and nothing in core depends on it |
| `sheets` | pull | sheets | Google Sheets as a structured source |
| `feed` | pull | feed | RSS and Atom monitoring of a publisher. Future |

`Document.sourceUrl` stays attribution only and the backend never fetches it. The `url`
connector is the one deliberate, audited exception. An editor explicitly asked for that URL,
the request goes through the same hardening as every other outbound fetch, and the result is
stored as a `Media` artefact so it is never fetched again.

### Type detection

The connector reports a MIME type and the pipeline does not trust it. Detection runs in order.

1. Magic-byte signature, using `src/utils/fileSignature.ts` carried over from v2.
2. `Content-Type`, for the `url` connector.
3. File extension, last.

If the signature and the declared type disagree, the document is marked `failed` with a clear
message. This is already how `/api/airtable-upload` validates uploads in v2, and the rule
carries forward to every connector.

## 5.3 Content extraction

MIME type selects the `ContentExtractor` adapter, most specific first.

| Extractor | Plugin | Accepts |
|---|---|---|
| `plaintext` | core | `text/plain`, `text/markdown`, `text/html` with readability extraction |
| `tika` | tika | `application/pdf`, Word, Excel, PowerPoint, OpenDocument, RTF, EPUB, and the rest of Tika's roughly 1,000 formats |
| `ocr` | ocr | Scanned PDFs and images, when the text layer is empty. Future |

Core alone handles plain text and HTML, which is enough for a working system with no Tika
container. Adding `plugin-tika` adds everything else, which is how ingest from docs, Excel, CSV
and URLs is satisfied for the unstructured half.

An extractor returns Unicode-normalised (NFC) plain text, a page or section count where it knows
one, and any document metadata it recovered, such as title, author and date, as suggestions an
editor may accept.

Extractors normalise and collapse whitespace. They discard no characters, unlike v2's
`cleanText` ([§2.7](02-architecture.md#one-bug-to-fix-not-port)).

Excel and CSV are ambiguous. A spreadsheet may be a document, such as a budget table to extract
promises from, or a dataset whose rows are promises. The editor chooses at upload time. The
default is the structured path for CSV and the document path for XLSX, and either can be
switched before processing starts.

## 5.4 Processing state machine

`Document.processing.status` is the single source of truth and the work queue
([§3.7](03-data-model.md#37-documents)).

```
pending ─► fetching ─► fetched ─► extracting ─► extracted ─► analysing ─► analysed ─► completed
   │                                                                                      ▲
   └──────────────────── imported (structured path) ──────────────────────────────────────┘

any state ─► failed          any state ─► needs-review
```

Every task writes the status before and after its operation, so a document's position is always
visible in the admin, including to the person who uploaded it. v2 could only deliver that
feedback by writing strings into Airtable cells.

```ts
async function runStage<T>(doc: Document, stage: ProcessingStatus, fn: () => Promise<T>) {
  await setStatus(doc.id, stage, { startedAt: new Date() })
  try {
    const result = await fn()
    await setStatus(doc.id, doneStateFor(stage), { completedAt: new Date() })
    return result
  } catch (err) {
    await setStatus(doc.id, 'failed', { message: describe(err), lastAttemptAt: new Date() })
    throw err
  }
}
```

## 5.5 AI extraction

Owned by `plugin-ai`, and optional. With the plugin disabled, documents stop at `extracted` and
claims are entered by hand.

The algorithm is carried over from v2 unchanged in substance. It is good, and its hallucination
guard is the most valuable thing in the repository.

**Pass 1, per-chunk extraction.** The text is split into overlapping chunks on paragraph and
sentence boundaries. Each chunk goes to the selected `LLMProvider` with a structured-output
schema of `{ category, summary, sourceQuotes[] }`. The prompt insists on specific verifiable
future commitments, forbids merging two commitments into one, and requires exact quotes in the
document's own language.

**The guard.** Candidates are deduplicated, then every candidate whose quotes do not literally
appear in the normalised document text is dropped. This is `hasVerifiableQuote` and
`mergeByAtomicPromise` in `src/tasks/extractPromises.ts:189-213`. It is the difference between
an assistant and a fabrication engine, and it must survive any refactor.

**Pass 2, normalisation.** A tool-forced pass splits compound commitments into atomic ones and
titles the set, then runs through the same verification again.

**Persistence.** Results become one `Extraction` with its `candidates[]`, all
`decision: 'pending'`. Nothing becomes a claim without a human.

### What is dropped from v2

| Dropped | Why |
|---|---|
| The 14-provider configuration matrix in the admin | Becomes `LLMProvider` adapters, and a deployment enables the one or two it uses |
| Per-document cost budgeting (`documentBudget.ts`, `maxCostUsdPerDocument`, per-million-token pricing in settings) | Nine tunables that encode pricing which goes stale. Replaced by one concurrency limit, one per-call timeout and one per-document token ceiling |
| `ai-extraction-export-rows` | A 28-column denormalised table maintained by hooks on five collections, existing only to produce a CSV. Replaced by an export that queries live ([§7.6](07-public-site.md#export)) |

### Review queue

The screen reviewers live in. For one document, each candidate appears with its proposed title,
category and confidence, and with its verified quotes highlighted in the source text. The
actions are Accept, Edit and accept, and Reject with a reason.

Accepting creates a `Claim` with `enteredBy: 'ai'`, `recordStatus: 'hold'` and
`verification.verdict: 'unverified'`, linked back to the extraction and candidate. Rejecting
records the reason, which is how extraction quality becomes measurable instead of anecdotal.

## 5.6 Structured import

For CSV, XLSX and sheets, rows become records directly (D18). The flow is map, preview, commit,
never a blind upload.

1. **Inspect.** The importer reads headers and the first rows and returns a `TableShape`.
2. **Map.** The editor maps columns to fields. Mappings are saved as reusable profiles, so a
   partner who sends the same shape monthly maps once.
3. **Preview.** The import runs with no writes and reports rows to create, rows to update, rows
   to skip, and per-row validation errors with row numbers. An `ImportJob` record holds the
   result.
4. **Commit.** Only after the preview is accepted.

Target shapes are claims (with promisor and category resolved by slug or name), actors, claim
updates for bulk-loading a history, and documents as metadata plus a source URL.

Each target declares a natural key: `(country, slug)` for claims and actors, `(claim, date)` for
updates. Re-importing the same file updates rather than duplicates. An unresolvable reference,
such as a promisor name that matches nothing, is reported as a row error instead of silently
creating a stub record.

This is also how any curated list still sitting in Airtable comes in at launch, as ordinary
day-one data entry rather than a migration
([§9.3](09-launch.md#93-content-the-old-tools-hold)).

## 5.7 Verification

The claim goes to whichever `VerificationProvider` is active ([§6](06-plugins.md)). Either way
the outcome is the same three fields on the claim, `verification.verdict`, `verifiedAt` and
`rationale`, and the claim stays in PromiseTracker.

Verdicts of `false` and `misleading` are never published and never auto-deleted. They are the
audit trail that makes extraction quality and systematic prompt failures visible. Archiving one
is a deliberate admin action.

## 5.8 Publishing

Verification and publication are two separate steps, on purpose.

```
verdict = verified            →  the claim is true to the source
recordStatus = ready          →  the editorial content is fit to publish
both, plus ancestry           →  _status = published            (§4.2)
```

A verified promise with a half-written summary should not be live. Collapsing the two into one
switch would make that impossible to express.

## 5.9 Resilience

### Retries

| Error | Retry | Fallback |
|---|---|---|
| Network timeout | 3 times, exponential backoff | Next item, and alert above a 10% failure rate |
| Rate limit (429) | Yes, honouring `Retry-After` | Requeue, and alert if sustained over 5 minutes |
| Service unavailable (503) | 3 times | Skip, and the scheduled sweep retries |
| Invalid data (400) | No | Mark `failed` with a specific message |
| Auth error (401 or 403) | No | Fail immediately and alert, because a credential is wrong |
| Server error (500) | 2 times | Next item |

Backoff starts at 1s, doubles, and caps at 30s.

### Timeouts

| Operation | Timeout |
|---|---|
| File fetch | 5 min total, 30s per redirect hop |
| Text extraction | 2 min |
| One AI call | 2 min |
| One document's AI stage | 20 min |
| Verification provider call | 1 min |
| Health check | 5s |

### Stuck jobs

A document stuck in a transient state has failed outside the application's control, through a
restart, a network stall or a hung dependency, and gets its own recovery path.

| Transient state | Considered stuck after |
|---|---|
| `fetching` | 10 min |
| `extracting` | 5 min |
| `analysing` | 25 min |
| any other | 2 min |

A sweep runs every 5 minutes. `retryCount` is one budget shared by thrown errors and stuck
sweeps, so a document cannot ping-pong between the two forever. Under 5, the sweep re-enqueues
at the start of the current stage and increments. At 5, it marks the document `failed` with the
last known cause and stops sweeping it.

### Circuit breakers and rate limits

Every external client, including Tika, the selected LLM provider, Superdesk and any connector,
is wrapped in a breaker: open after 5 consecutive failures, retry after 60s, 3 probe requests
before closing. Per-provider concurrency and minimum-interval limits are configured per adapter
rather than globally.

### Idempotency

- **Inbound pushes** carry a delivery id, checked against the last-seen id on the target record
  before processing. v2's `/api/meedan-sync` already does this with a SHA-256 body fingerprint
  and an in-flight 409, and the mechanism carries over.
- **Record creation** relies on database unique indexes rather than application-level checks. On
  a duplicate-key error the handler falls back to update. No distributed locks and no
  `SELECT FOR UPDATE`, because the database serialises conflicting inserts atomically.
- **Files** deduplicate on SHA-256 checksum, and two documents may legitimately reference one
  `Media` item.
- **Scheduled workflows** take an atomic lock (`src/lib/workflowLocks.ts`), so an overlapping run
  skips rather than doubles up.

## 5.10 Tasks

| Task | Plugin | Retries | Trigger |
|---|---|---|---|
| `pullSource` | per connector | 3 | Schedule, pull connectors only |
| `fetchDocument` | core | 2 | On document create with a pending fetch |
| `extractText` | core | 2 | On `fetched` |
| `extractCandidates` | ai | 2 | On `extracted`, when AI is enabled |
| `runImport` | core | 0 | On import commit |
| `submitForVerification` | verification adapter | 3 | On claim create, if the adapter pushes |
| `pullVerdicts` | verification adapter | 3 | Schedule, for reconciliation |
| `recomputeClaimStatus` | core | 3 | On claim-update change |
| `cascadeStatus` | core | 3 | On `recordStatus` change ([§4.3](04-governance.md#43-the-cascade)) |
| `sweepStuck` | core | 1 | Every 5 min |
| `cleanupJobs` | core | 1 | Hourly |

Every task is wrapped in the Sentry tracing helper carried over from `src/tasks/utils.ts`, so
each one has a span, a duration, structured start, complete and error logs, and the ids needed
to trace one document through the whole pipeline.
