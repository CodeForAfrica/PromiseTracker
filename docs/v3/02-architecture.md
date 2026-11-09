# 2. Architecture

## 2.1 Shape of the system

```
┌──────────────────────────────────────────────────────────────────────┐
│                              KERNEL                                   │
│  port interfaces · plugin contract · registry · boot validation       │
│  (knows nothing about promises, politicians or Superdesk)             │
└──────────────────────────────────────────────────────────────────────┘
                                   ▲
                      declares extension points
                                   │
┌──────────────────────────────────────────────────────────────────────┐
│                          plugin-core                                  │
│  The domain. Collections, admin UI, public data layer.                │
│  Ships native adapters for every port:                                │
│    verification:native · connector:upload · extractor:plaintext       │
│    importer:csv                                                       │
└──────────────────────────────────────────────────────────────────────┘
       ▲             ▲              ▲               ▲             ▲
   depends on    depends on    depends on     depends on     depends on
       │             │              │               │             │
┌────────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────┐
│ plugin-ai  │ │plugin-   │ │ plugin-      │ │ plugin-   │ │ plugin-    │
│            │ │ tika     │ │ superdesk    │ │ airtable  │ │ geo        │
│ LLMProvider│ │Extractor │ │ Verification │ │ Connector │ │ map data   │
└────────────┘ └──────────┘ └──────────────┘ └───────────┘ └────────────┘
```

Three layers with strict boundaries.

**Kernel.** Interfaces, the plugin contract, a registry, and startup validation. It holds no
domain concepts and could host a different product.

**plugin-core** (D13). Every domain collection, the admin experience, the public data layer,
and a working implementation of every port. Enabling only core gives a complete, publishable
PromiseTracker whose sole external dependencies are MongoDB and S3 (D4).

**Integration plugins.** Each declares `dependsOn: ["core"]`, extends core's collections through
published extension points, and registers one or more port implementations.

### Why the core is a plugin (D13)

If core were the app and plugins were decoration, every integration would reach into app
internals and the boundary would rot. That is how v2 ended up with Airtable string-writing
scattered across six pipeline tasks. Making core a plugin forces it to publish the same
extension API everyone else uses. If an extension point is not good enough for
`plugin-superdesk`, core feels it too.

It also makes core replaceable in principle. A deployment with a different domain model swaps
`plugin-core` and keeps the kernel, the pipeline shape and the integrations.

## 2.2 Ports

A port is a TypeScript interface in the kernel. An adapter implements it and registers under a
plugin-qualified id.

| Port | Cardinality | Question it answers | Core adapter | Other adapters |
|---|---|---|---|---|
| `VerificationProvider` | exactly one | Where do humans verify claims? | `native` (review in the admin) | `superdesk`, and `check` (specified, not built) |
| `SourceConnector` | zero or more, `upload` always on | Where does content come from? | `upload`, `url` | `airtable`, `sheets`, `feed` |
| `ContentExtractor` | one or more, chosen by MIME type | How do bytes become text? | `plaintext` (txt, md, html) | `tika` (PDF, DOCX, XLSX and more), `ocr` |
| `StructuredImporter` | zero or more | How do tabular rows become records? | `csv`, `xlsx` | `sheets` |
| `LLMProvider` | many registered, one selected | Which model extracts candidates? | none, since AI is optional | `google`, `openai`, `anthropic` and others |

Splitting ingest into three ports is what makes D18 work. Ingesting a CSV of promises a partner
compiled and ingesting a 200-page manifesto PDF are different problems. One is a row-to-record
mapping that needs no AI. The other is text extraction followed by AI extraction. v2 had one
path and assumed PDFs.

### Interfaces

```ts
// kernel/ports.ts

export interface VerificationProvider {
  readonly id: string
  /** Send a claim for human verification. Returns the external reference, if any. */
  submit(claim: ClaimRef, ctx: PortContext): Promise<ExternalRef | null>
  /** Pull verdicts changed since a cursor. Used for reconciliation and backfill. */
  pull(since: SyncCursor, ctx: PortContext): Promise<VerdictUpdate[]>
  /** Handle an inbound push from the provider, if it supports one. */
  receive?(payload: unknown, headers: Headers, ctx: PortContext): Promise<VerdictUpdate[]>
  health(): Promise<HealthResult>
}

export interface SourceConnector {
  readonly id: string
  readonly mode: 'push' | 'pull' | 'manual'
  /** Pull mode only: list items awaiting ingest. */
  list?(since: SyncCursor, ctx: PortContext): Promise<SourceItem[]>
  fetch(item: SourceItem, ctx: PortContext): Promise<FetchedContent>
  health(): Promise<HealthResult>
}

export interface ContentExtractor {
  readonly id: string
  /** MIME types this extractor claims, most specific wins; '*' is the fallback. */
  readonly accepts: readonly string[]
  extract(input: FetchedContent, ctx: PortContext): Promise<ExtractedText>
  health(): Promise<HealthResult>
}

export interface StructuredImporter {
  readonly id: string
  readonly accepts: readonly string[]
  /** Inspect without writing: used to build and preview a column mapping. */
  inspect(input: FetchedContent): Promise<TableShape>
  import(input: FetchedContent, mapping: ImportMapping, ctx: PortContext): Promise<ImportResult>
}

export interface LLMProvider {
  readonly id: string
  readonly models: readonly ModelDescriptor[]
  generate(req: GenerateRequest, ctx: PortContext): Promise<GenerateResult>
  health(): Promise<HealthResult>
}
```

`PortContext` carries the Payload instance, a scoped logger, an `AbortSignal`, and the resolved
settings group for that plugin. Adapters never read `process.env` directly and never import
from another plugin.

## 2.3 The plugin contract

A plugin is a factory returning a manifest. The kernel does the wiring.

```ts
export interface PluginManifest {
  readonly id: string                  // 'core' | 'superdesk' | 'ai' | ...
  readonly version: string
  readonly dependsOn?: readonly string[]

  /** Collections and globals this plugin owns outright. */
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]

  /** Changes to collections owned by another plugin. */
  extend?: Record<string, CollectionExtension>

  /** Port implementations, keyed by port name. */
  provides?: {
    verification?: VerificationProvider
    connectors?: SourceConnector[]
    extractors?: ContentExtractor[]
    importers?: StructuredImporter[]
    llm?: LLMProvider[]
  }

  tasks?: TaskConfig[]
  workflows?: WorkflowConfig[]
  /** Declared, not registered: App Router routes are filesystem entries. */
  routes?: PluginRoute[]
  /** A group appended to the Settings global, namespaced by plugin id. */
  settings?: Field[]
  /** Validated at boot when the plugin is enabled. */
  requiredEnv?: readonly string[]
}

export interface CollectionExtension {
  /** Appended fields. Always optional, see §2.5. */
  addFields?: Field[]
  /** Core field names this plugin becomes the authority for. */
  ownFields?: string[]
  /** Hide create and delete: this plugin owns the record lifecycle. */
  ownLifecycle?: boolean
  /** A banner shown on the edit view explaining who owns this data. */
  notice?: Record<string, string>
  hooks?: Partial<CollectionHooks>
}
```

One environment variable lists the enabled plugins, and port selection is explicit.

```bash
PT_PLUGINS=core,tika,ai,superdesk       # core is implied but may be listed
PT_VERIFICATION=superdesk               # which VerificationProvider wins
PT_LLM_MODEL=google:gemini-2.5-pro      # which LLMProvider and model
```

Plugin choice is evaluated at boot, not at runtime. Field injection and route registration
cannot be toggled per request, and a mid-session change of ownership would create exactly the
conflicts §2.5 exists to prevent.

### Boot sequence

1. Read `PT_PLUGINS` and load each manifest.
2. Verify `dependsOn` is satisfied, then sort topologically. A cycle is a fatal error.
3. Resolve the selected adapter for each exclusive port. Zero or more than one is a fatal
   error, and the message names the candidates and the variable that picks between them.
4. Merge collections, then apply `extend` in dependency order.
5. Append each plugin's settings group to the Settings global under its id.
6. Validate `requiredEnv` for enabled plugins only.
7. Register tasks and workflows.
8. Log the resolved configuration as one structured line: plugins, port bindings, adapter
   versions. This is the first thing anyone will want when debugging a deployment.

Failing fast at boot departs from the v2 reference architecture, where disabled plugin routes
returned `503` at request time. That suits a genuinely optional endpoint. It is the wrong
behaviour for a required capability with interchangeable implementations. A deployment with no
verification provider is misconfigured and should not start.

## 2.4 Mode matrix

| Enabled | Ingest | Text extraction | Candidate generation | Verification |
|---|---|---|---|---|
| `core` | Admin upload, URL, CSV and XLSX import | Plain text and HTML only | None. Promises entered by hand | Review queue in the admin |
| `core,tika` | as above | PDF, DOCX, XLSX, PPTX, ODF, RTF and more | None | Admin |
| `core,tika,ai` | as above | as above | AI candidates into the review queue | Admin |
| `core,tika,ai,superdesk` | as above | as above | AI candidates into the review queue | Superdesk |
| `core,tika,ai,superdesk,airtable` | plus Airtable | as above | as above | Superdesk |

The first row keeps everyone honest. It is a complete product, it is what CI runs against, and
it is what a new contributor gets from `pnpm dev` with no credentials.

## 2.5 Ownership and single source of truth (D5)

When a plugin owns data, exactly one writer exists. The kernel and code review enforce six
rules.

1. **Injected fields are always optional** and carry a sensible default. A plugin may be removed
   after months of use, and required fields would invalidate every existing record.
2. **A plugin may not change a core field's type,** only its admin presentation and access.
3. **Owned fields become read-only in the admin** and reject writes from anyone but the owning
   plugin and a super-admin, whose override is audit-logged.
4. **Lifecycle ownership hides create and delete** for that collection and shows a notice
   explaining where the data comes from.
5. **Plugin fields are namespaced** under a group named for the plugin, so `superdesk.guid`
   rather than a bare `guid`. Two plugins can never collide, and removal is a clean sweep.
6. **A plugin never deletes a core record.** Upstream deletion maps to `recordStatus: archived`
   ([§4](04-governance.md)). Deleting a record with downstream work, such as extracted claims,
   completed verification or a published timeline, would destroy irreversible effort silently.

### Example: `plugin-superdesk` taking ownership of verification

```ts
extend: {
  claims: {
    addFields: [
      {
        name: 'superdesk',
        type: 'group',
        admin: { readOnly: true, condition: () => true },
        fields: [
          { name: 'guid', type: 'text', index: true },
          { name: 'version', type: 'number' },
          { name: 'state', type: 'text' },
          { name: 'itemUrl', type: 'text' },
          { name: 'lastSyncedAt', type: 'date' },
          { name: 'lastSyncStatus', type: 'select', options: ['success', 'failed', 'pending'] },
          { name: 'lastSyncError', type: 'text' },
        ],
      },
    ],
    ownFields: ['verification.verdict', 'verification.verifiedAt', 'verification.rationale'],
    notice: {
      en: 'Verification for this claim is managed in Superdesk. Changes made here will be overwritten on the next sync.',
      fr: 'La vérification de cette affirmation est gérée dans Superdesk. Les modifications effectuées ici seront écrasées lors de la prochaine synchronisation.',
    },
  },
}
```

Note what it does not own: title, statement, category, promisor, the update timeline. Those stay
editable in PromiseTracker whichever verification backend is active. Only the verdict crosses
the boundary.

## 2.6 Technology

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router), React 19, TypeScript strict | Carried from v2. The admin and the public site share one deployment |
| CMS | Payload CMS 3.x | Admin UI, a plugin API strong enough for §2.3, typed, a job queue, Next-native |
| Database | MongoDB | Flexible schema for an evolving model, Payload's best-supported adapter, already in production |
| Media | S3-compatible | Already in production |
| Text extraction | Apache Tika, self-hosted | Open source, no per-call cost, over 1,000 formats |
| AI | Vercel AI SDK behind `LLMProvider` | Already in v2 as `src/lib/ai/providerRegistry.ts`, and becomes the adapter registry |
| Errors | Sentry | Already instrumented in `src/tasks/utils.ts` and `src/workflows/utils.ts` |
| Jobs | Payload Jobs | Already in use, and workflow locking exists in `src/lib/workflowLocks.ts` |
| Tests | Vitest for integration, Playwright for e2e | Already in use, and the security specs are the regression floor |

No new infrastructure. The change is structural, not operational.

## 2.7 Reused from v2

Carried forward deliberately, not rewritten.

| What | Where in v2 | Why it survives |
|---|---|---|
| Download hardening | `src/utils/ssrf.ts`, `src/utils/files.ts`, `src/utils/fileSignature.ts` | HTTPS only, DNS re-resolution per redirect hop, private-range rejection, byte caps, magic-byte validation. Documented in `docs/remote-file-ingestion.md`. Hard to get right, and already right |
| Quote verification | `src/tasks/extractPromises.ts`, functions `hasVerifiableQuote` and `mergeByAtomicPromise` at lines 189 to 213 | Drops any AI candidate whose quote does not literally appear in the source. This is the hallucination guard, and it is load-bearing |
| AI provider registry | `src/lib/ai/providerCatalog.ts`, `providerRegistry.ts`, around 800 lines | Already a registry in all but name, and becomes the `LLMProvider` adapters |
| Route grammar | `src/lib/routes/publicRoutes.ts` | Pure resolver functions, with the rule to use the resolved entity and never re-query by slug |
| Encrypted settings | `src/fields/encryptedSecret.ts` | Encrypts on write, masks on read, restricts field access to super-admins, and preserves the value when the mask is resubmitted |
| Slug and link fields | `src/fields/slug/*`, `src/fields/link/*` | Fine as they are |
| Workflow locking | `src/lib/workflowLocks.ts` | Atomic `findOneAndUpdate` cron guard with TTL |
| Media deduplication | `src/collections/Media.ts` and `downloadDocuments` | Source URL, then `externalUrl`, then SHA-256 checksum |
| Observability wrappers | `src/tasks/utils.ts`, `src/workflows/utils.ts` | Sentry spans, structured task logging, workflow run context |
| Security tests | `tests/int/{ssrf,fileSignature,requestGuards,securityHeaders,privilegedAccess,publicApiAccess,publicRoutes}.int.spec.ts` | These encode hard-won rules. They are the floor, not a starting point |

### One bug to fix, not port

`cleanText` in `src/tasks/extractDocuments.ts:19` strips every non-ASCII character with
`.replace(/[^\x00-\x7F]/g, "")`. On a bilingual English and French product this silently
corrupts every accented word in every French document, and it would do the same to Portuguese,
Swahili orthography and any African language with diacritics. v3 normalises Unicode to NFC and
collapses whitespace. It discards no characters.
