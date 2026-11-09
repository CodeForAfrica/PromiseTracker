# 3. Data model

`plugin-core` owns everything here unless stated otherwise. Payload manages `createdAt` and
`updatedAt` on every collection, so they are not listed. [§4](04-governance.md) explains
`recordStatus` and the computed `_status`. Read it before implementing any hook here.

## 3.0 At a glance

```
Country ──┬── Actor ──┬── (person | party | institution | place)
          │           └── claims made by this actor
          │
          ├── Document ──► Extraction ──► candidates
          │                                   │ accepted
          │                                   ▼
          └────────────────────────────── Claim ──► ClaimUpdate[]   ← the history
                                             │              ▲
                                             │              │ promoted
                                             └── Category   Submission
                                                 ClaimStatus
```

Against v2: `tenants` is gone (D10), `political-entities` becomes `actors` with a kind (D14),
`promises` becomes `claims` with a type (D2), `claim-updates` is new and is the point of the
product (D7), `promise-status` is authored locally instead of synced from Meedan, `category`
becomes a real taxonomy, and `global-pages`, `global-site-settings`, `entity-page`,
`promise-updates` and `ai-extraction-export-rows` all disappear.

## 3.1 Countries

Replaces v2's `tenants`. A country is a routing namespace and a scoping field, not a tenant.
One deployment, one database, one set of users (D10).

```ts
interface Country {
  id: string
  code: string          // ISO 3166-1 alpha-2, lowercase. UNIQUE, INDEXED. The URL segment: "ke"
  alpha3?: string       // ISO 3166-1 alpha-3, for data interchange
  name: string          // localized
  officialName?: string // localized
  flag?: Media
  defaultLocale: 'en' | 'fr'
  locales: ('en' | 'fr')[]       // which locales this country publishes in
  geo?: GeoRef                   // §3.9. Centroid and bounds for the country map
  about?: RichText               // localized, shown on the country landing page
  branding?: {
    accentColor?: string
    heroImage?: Media
  }
  partners?: Partner[]
  meta?: SeoMeta
  recordStatus: 'ready' | 'hold' | 'archived'   // default 'hold'
}
```

Indexes: `code` (unique), `recordStatus`.

`code` is both the identity and the URL segment, which is the overload D10 removes from v2's
`tenant.country`. Per-country `locales` lets a Kenyan tracker be English-only while a Senegalese
one is French-only. Archiving a country hides every actor, claim and document under it
([§4](04-governance.md)).

## 3.2 Actors

One collection, four kinds (D14). A politician, a party, a ministry and a county all make
promises. Modelling them separately would mean three more collections, three more route trees,
and a union query every time you ask who makes promises here.

```ts
type ActorKind = 'person' | 'party' | 'institution' | 'place'

interface Actor {
  id: string
  country: Country              // required, INDEXED
  kind: ActorKind               // required, INDEXED
  name: string                  // required, useAsTitle
  shortName?: string            // "UDA", "MoH". Used in dense UI
  slug: string                  // unique per (country, kind). INDEXED
  parent?: Actor                // ward → constituency → county; department → ministry
  image?: Media
  description?: RichText        // localized
  links?: { label: string; url: string }[]   // official site, social
  geo?: GeoRef                  // §3.9
  meta?: SeoMeta
  recordStatus: 'ready' | 'hold' | 'archived'   // default 'hold'

  // ── kind-specific, shown conditionally in the admin ──

  person?: {
    honorific?: string
    gender?: string
    dateOfBirth?: string
    originPlace?: Actor         // kind='place'. Where they are from, drives the map
    offices: Office[]           // at least one
  }

  party?: {
    abbreviation?: string
    founded?: string
    colors?: { primary?: string; secondary?: string }
    leader?: Actor              // kind='person'
  }

  institution?: {
    institutionType: 'ministry' | 'agency' | 'county-government' | 'parastatal'
                   | 'commission' | 'legislature' | 'other'
    jurisdiction?: Actor        // kind='place'
    headedBy?: Actor            // kind='person'
    establishedOn?: string
  }

  place?: {
    placeType: 'region' | 'province' | 'state' | 'county' | 'district'
             | 'constituency' | 'ward' | 'city' | 'other'
    adminLevel: number          // 1 = first-level subdivision, 2 = second, and so on
    population?: number
    externalCode?: string       // GADM / geoBoundaries / HASC identifier
  }
}

interface Office {
  title: string                 // "President", "Governor", "Cabinet Secretary for Health"
  institution?: Actor           // kind='institution'
  jurisdiction?: Actor          // kind='place'. "Governor of Nairobi"
  party?: Actor                 // kind='party'. Party at the time of this office
  from: string                  // required
  to?: string                   // open-ended while in office
  isCurrent: boolean            // derived from `to`, stored for cheap querying, INDEXED
}
```

Indexes: `(country, kind, slug)` unique, `(country, kind, recordStatus)` for listings, `parent`,
`person.offices.isCurrent`.

Slug uniqueness is scoped to `(country, kind)`. A politician and a county may both be slugged
`nairobi` without colliding, because typed URL segments keep them apart (D15). v2's
`ensureUniqueSlug` enforced per-tenant uniqueness, and the same hook gains the kind dimension.

`offices[]` replaces v2's flat `position`, `region`, `periodFrom` and `periodTo`, which could
represent only one office and lost a politician's history the moment they changed job.

`originPlace` powers "where this politician is from" on the map. `offices[].jurisdiction`
powers "where they govern". The two are often different, and v2 could express neither.

## 3.3 Claims

Replaces v2's `promises`. Typed (D2), so one collection, one pipeline and one review queue
serve campaign promises and other verifiable claims.

```ts
type ClaimType = 'campaign-promise' | 'policy-pledge' | 'budget-commitment' | 'public-statement'

interface Claim {
  id: string
  country: Country              // required, INDEXED. Denormalised from promisor for query speed
  type: ClaimType               // required, INDEXED. default 'campaign-promise'
  title: string                 // required, localized. The editorial headline
  slug: string                  // unique per country. INDEXED
  statement: string             // required. The exact words, verbatim, never paraphrased
  summary?: RichText            // localized. Editorial context

  promisor: Actor               // required, INDEXED. Who made it
  coPromisors?: Actor[]         // for example the party as well as the candidate
  jurisdiction?: Actor          // kind='place'. Where it applies, if narrower than the country

  category: Category            // required, INDEXED
  tags?: string[]

  source?: Document             // INDEXED. May be absent for a manually entered claim
  sourceLocator?: {
    page?: number
    chunk?: number
    timestamp?: string          // for audio and video sources
    excerptStart?: number
  }
  sourceUrl?: string            // attribution only. NEVER fetched by the backend (§8)
  madeOn?: string               // when the promise was made
  targetDate?: string           // the deadline it set itself, when it set one
  language: 'en' | 'fr'

  // ── tracking ──
  currentStatus?: ClaimStatus   // READ-ONLY. Derived from the latest published ClaimUpdate
  statusAsOf?: string           // READ-ONLY. Date of that update
  updateCount?: number          // READ-ONLY. Denormalised for listings

  // ── verification ──
  verification: {
    verdict: 'unverified' | 'verified' | 'false' | 'misleading'   // default 'unverified'
    verifiedAt?: string
    verifiedBy?: User | string  // a user, or an external reviewer's name
    rationale?: RichText
    report?: Media              // a published fact-check artefact
  }

  // ── provenance ──
  extraction?: Extraction       // set when AI-derived
  confidence?: number           // 0 to 1, from the extraction
  enteredBy: 'ai' | 'manual' | 'import'   // INDEXED. Lets you audit AI quality

  image?: Media
  meta?: SeoMeta
  recordStatus: 'ready' | 'hold' | 'archived'   // default 'hold', see §4.2
}
```

Indexes: `(country, recordStatus, _status)`, `(promisor, _status)`,
`(country, category, _status)`, `(country, currentStatus)`, `slug` unique per country,
`verification.verdict`, and a text index on `title`, `statement` and `summary`
([§7.3](07-public-site.md#73-search)).

Versions and drafts are enabled. Every published change is recoverable, and an editor can stage
a correction without taking the page down.

No human ever writes `currentStatus`. An `afterChange` hook on `claim-updates` recomputes it
from the claim's updates. This is the structural fix for v2, where status was a field someone
set and the timeline was fiction.

`statement` is the verbatim quote, and it is what the AI quote-verification guard checks
against the source document. A candidate whose quote cannot be found in the source text is
dropped ([§5.5](05-pipeline.md#55-ai-extraction)).

`enteredBy` makes "how good is our extraction, really?" answerable, which the v2 model could
not do once a promise round-tripped through Check.

`verification.verdict` is the only field a verification plugin owns
([§2.5](02-architecture.md#25-ownership-and-single-source-of-truth-d5)).

## 3.4 Claim statuses

Authored in the CMS. In v2 this collection was seeded from Meedan's `verification_statuses`,
joined on `meedanId` in three places, and only ever created, never updated, so a label fixed in
Check never reached the site.

```ts
interface ClaimStatus {
  id: string
  slug: string                  // unique, stable: 'kept', 'in-progress', 'broken', and so on
  label: string                 // required, localized
  description: string           // required, localized. The public "what does this mean?" copy
  group: 'not-started' | 'in-progress' | 'kept' | 'broken' | 'inconclusive'   // required
  color: string                 // hex, used for chips and charts
  textColor: string             // hex, default '#ffffff'
  order: number                 // display order
  isDefault?: boolean           // the status a new claim's first update suggests
}
```

`group` is new and it earns its place. v2's profile charts had to be configured per page by
picking statuses into three `chartGroups` on a `hero` block, with a hardcoded fallback and a
balancing redistribution when the configuration was absent. Grouping belongs on the status, not
on a page block. Define it once and every chart, filter and scorecard derives from it.

Statuses are global rather than per country, which makes cross-country comparison meaningful.

## 3.5 Claim updates

New in v3, and the reason v3 exists (D7).

```ts
interface ClaimUpdate {
  id: string
  claim: Claim                  // required, INDEXED
  date: string                  // required, INDEXED. When the development happened,
                                // not when it was recorded
  status: ClaimStatus           // required. The status as of this date
  title?: string                // localized. A short headline for the timeline entry
  narrative: RichText           // required, localized. What happened, and how we know
  evidence: Evidence[]          // at least one for a status change
  author?: User
  attribution?: string          // credit for a citizen contributor, with consent
  sourceType: 'editorial' | 'citizen-submission' | 'import' | 'automated'
  submission?: Submission       // set when promoted from the moderation queue
  recordStatus: 'ready' | 'hold' | 'archived'   // default 'hold'
}

interface Evidence {
  label: string                 // localized
  kind: 'link' | 'document' | 'media' | 'quote'
  url?: string                  // attribution only, never fetched
  document?: Document
  media?: Media
  quote?: string
  publisher?: string
  publishedOn?: string
}
```

Indexes: `(claim, date)` descending for the timeline query, and `(claim, recordStatus)`.

On create, update or delete of a published `ClaimUpdate`, a hook sets three fields on the parent
claim.

```
claim.currentStatus = status of the most recent ClaimUpdate where _status === 'published'
                      ordered by date desc, then createdAt desc
claim.statusAsOf     = that update's date
claim.updateCount    = count of published updates
```

With no published updates, `currentStatus` is null and the public page shows the claim as not
yet assessed. A claim with a verdict but no updates is a promise recorded but not yet tracked,
which is a legitimate and visible state.

`date` is separate from `createdAt` because promises are tracked retrospectively. An editor in
2026 records that a hospital opened in 2024. The timeline must order by when things happened,
not by when someone got round to typing them.

## 3.6 Categories

A real taxonomy, replacing v2's free-text `promises.category`.

```ts
interface Category {
  id: string
  slug: string                  // unique, INDEXED
  name: string                  // required, localized
  description?: string          // localized
  icon?: Media
  color?: string
  parent?: Category             // one level of nesting, no deeper
  order: number
}
```

Global rather than per country, which makes "healthcare promises across Africa" a query rather
than a reconciliation exercise.

## 3.7 Documents

Source material. The headline change is one explicit processing state, replacing v2's state
scattered across `files exists`, `extractedText.text exists`, `fullyProcessed`,
`extractionReview` and a status string written into an Airtable cell.

```ts
type ProcessingStatus =
  | 'pending' | 'fetching' | 'fetched'
  | 'extracting' | 'extracted'
  | 'analysing' | 'analysed'
  | 'imported'          // structured-import path, §5.6
  | 'completed' | 'failed' | 'needs-review'

interface Document {
  id: string
  country: Country              // required, INDEXED
  title: string                 // required
  actors?: Actor[]              // who this document is by or about
  type: 'manifesto' | 'speech' | 'budget' | 'policy' | 'report'
      | 'news' | 'dataset' | 'other'
  language: 'en' | 'fr'
  publishedOn?: string
  publisher?: string

  file?: Media                  // the stored artefact
  sourceUrl?: string            // attribution. Fetched ONLY via the `url` connector (§5.2)
  connector: string             // which SourceConnector brought it in: 'upload', 'url', ...
  mimeType?: string             // detected, not trusted from the client

  processing: {
    status: ProcessingStatus    // required, INDEXED. default 'pending'
    stage?: string              // human-readable label for the current operation
    message?: string            // the last error or notice, shown in the admin
    extractorId?: string        // which ContentExtractor handled it
    startedAt?: string
    lastAttemptAt?: string
    completedAt?: string
    retryCount: number          // default 0. One budget across errors and stuck sweeps
  }

  text?: string                 // extracted plain text, Unicode-normalised (NFC)
  textChars?: number
  pageCount?: number

  recordStatus: 'ready' | 'hold' | 'archived'   // default 'ready'
}
```

Indexes: `(processing.status, processing.lastAttemptAt)` for the work queue and the stuck sweep,
`(country, recordStatus)`, and `actors`.

`processing.status` is the work queue. v2's queue was `Processed = false` in an Airtable view,
so removing Airtable removed the queue. Making it an indexed enum is the single highest-value
change in the pipeline, and it decouples the pipeline from any ingest source.

`sourceUrl` is attribution only by default, exactly as the v2 reference architecture insists.
The one path that fetches a user-supplied URL is the explicit `url` connector, which runs
through the existing SSRF guard ([§8](08-security-ops.md)).

Documents are not public. Claim pages link to them as evidence by URL, but the collection is
admin-read-only, as in v2.

## 3.8 Extractions

The AI audit trail, and the review queue's backing store. Owned by `plugin-ai`.

```ts
interface Extraction {
  id: string
  document: Document            // required, INDEXED
  model: string                 // 'google:gemini-2.5-pro'
  promptVersion: string         // so a prompt change is attributable
  status: 'pending' | 'completed' | 'failed' | 'partial'
  error?: string
  tokensUsed?: number
  durationMs?: number
  rawResponse?: JSON            // retained for debugging, see retention in §8
  candidates: Candidate[]
}

interface Candidate {
  uniqueId: string              // stable, generated, survives re-extraction
  category?: string             // free text as proposed, mapped to a Category on acceptance
  summary: string               // the proposed claim title
  quotes: string[]              // verbatim spans, each verified against document.text
  confidence?: number
  decision: 'pending' | 'accepted' | 'rejected'   // INDEXED
  claim?: Claim                 // set on acceptance
  rejectedReason?: string
  reviewedBy?: User
  reviewedAt?: string
}
```

Re-extracting a document creates a new `Extraction` and leaves prior ones intact. Decisions
already made survive, and extraction quality over time becomes measurable.

## 3.9 Geo (D17)

A shared field group, used by `Country` and `Actor`. Enough to draw a map without turning
PromiseTracker into a GIS.

```ts
interface GeoRef {
  centroid?: { lat: number; lng: number }
  bounds?: { north: number; south: number; east: number; west: number }
  boundary?: Media              // a GeoJSON file, stored like any other upload
  boundarySource?: string       // 'geoBoundaries', 'GADM', 'OSM'. Attribution
  boundaryLicense?: string      // required when boundary is set
  externalCode?: string         // the id in that source, for refresh
  defaultZoom?: number
}
```

Boundary polygons are stored as uploaded GeoJSON rather than fetched live. Boundary datasets
carry licence terms, change rarely, and a live third-party tile or geometry dependency is
exactly the coupling v3 is removing. Attribution is required when a boundary is present.

The public map ([§7](07-public-site.md)) renders `boundary` when it exists and falls back to a
marker at `centroid`. A country with neither gets no map, so the feature degrades rather than
breaks.

Boundary files can be large. The admin warns above 2 MB and the public site serves a simplified
rendition. **CONFIRM** the topology-preserving simplification step at implementation time.

## 3.10 Submissions

Citizen input (D9), replacing v2's embedded Airtable form whose rows nothing ever read back.

```ts
interface Submission {
  id: string
  claim?: Claim                 // INDEXED. Absent for "we're missing a promise" reports
  country?: Country
  kind: 'update' | 'correction' | 'new-claim'
  body: string                  // required
  evidenceUrl?: string          // attribution only. NEVER fetched
  attachment?: Media
  submitterName?: string
  submitterEmail?: string
  consentToAttribute: boolean   // default false
  status: 'new' | 'accepted' | 'rejected' | 'spam'   // INDEXED. default 'new'
  moderatorNote?: string
  moderatedBy?: User
  moderatedAt?: string
  claimUpdate?: ClaimUpdate     // set when promoted
  // request metadata, for abuse handling
  ipHash?: string               // salted hash, never the raw address
  userAgent?: string
}
```

Access: `create` is public and rate-limited, and `read` is authenticated only. A submission is
never rendered publicly, in any status.

## 3.11 Supporting collections

**Media.** Unchanged from v2 in substance: `alt` (required), `externalUrl`, `checksum` (SHA-256,
indexed, drives deduplication), S3-backed, public read.

**Users.** `roles` (`super-admin`, `editor`, `contributor`, `reviewer`, `moderator`, `viewer`,
hasMany), `name`, and `countries?`, a relationship that exists but is not enforced in v3. See
[§4.6](04-governance.md#46-what-v3-does-not-do-d16).

**Pages.** One collection, replacing v2's `pages` and `global-pages` split. An optional
`country` relationship, where null means the page is global (`/about`) and set means it is a
country page (`/ke/about`). Same block set either way, and blocks that need a country render
empty when there is none.

**Partners.** `name`, `description`, `image`, `url`, optional `countries[]`.

**WorkflowLocks.** System collection, carried over verbatim from
`src/collections/WorkflowLocks.ts`.

**ImportJobs** (`plugin-core`). One record per structured import: the file, the chosen
`StructuredImporter`, the column mapping, a dry-run preview, counts of created, updated and
skipped rows, and per-row errors. See [§5.6](05-pipeline.md#56-structured-import).

## 3.12 Globals

**Site settings.** A single global, now that there is no tenancy: site title and description,
logos, navigation, footer, legal links, social links, newsletter configuration, default SEO.
Country-specific overrides live on the `Country` record rather than in a second global.

**Settings.** Integration credentials, super-admin read and write only. Core contributes the
feature toggles, and each plugin appends a namespaced group
([§2.3](02-architecture.md#23-the-plugin-contract)).

```ts
interface Settings {
  features: {
    aiExtractionEnabled: boolean
    submissionsEnabled: boolean
    publicApiEnabled: boolean
    embedsEnabled: boolean
  }
  // appended by plugins, namespaced by plugin id:
  superdesk?: { baseUrl; clientId; clientSecret; deskId; stageId; profileId; pushSecret }
  ai?: { credentials[]; model; limits }
  tika?: { url }
  airtable?: { apiKey; baseId }
}
```

Credentials live here rather than in environment variables because they change per deployment
without a redeploy, and because `src/fields/encryptedSecret.ts` already encrypts them at rest
and masks them on read. Environment variables select which plugins run. The database holds what
they need to run.

## 3.13 Localization

Content locales are `en` and `fr`, as in v2, driven by `NEXT_PUBLIC_LOCALES`.

Localized: `Country.name`, `officialName` and `about`, `Actor.name` and `description`,
`Claim.title` and `summary`, `ClaimUpdate.title` and `narrative`, `Evidence.label`,
`ClaimStatus.label` and `description`, `Category.name` and `description`, all page block text,
and site settings text.

Not localized: slugs, `Claim.statement`, codes, dates, colours and numbers. A verbatim quote is
not translated, since a translation would be a different object.

v2 shipped a French admin UI while leaving `promises.title`, `promises.description` and the
political-entity fields untranslated. v3 localizes the content people actually read.
