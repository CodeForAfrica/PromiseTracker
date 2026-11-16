import type { Payload } from 'payload'

/**
 * The ports in section 4.1 of the system specification. A port describes a
 * job. An adapter, provided by a plugin, does it.
 */

export type Logger = Pick<Payload['logger'], 'info' | 'warn' | 'error'>

/**
 * What every adapter method receives (section 4.2). An adapter reads its
 * configuration from here, never from environment variables or another
 * plugin's settings.
 */
export interface AdapterContext<TSettings = Readonly<Record<string, unknown>>> {
  payload: Payload
  logger: Logger
  signal: AbortSignal
  settings: TSettings
}

export interface HealthReport {
  healthy: boolean
  detail?: string
}

interface Adapter {
  /** Unique within its port, for example `native` or `check`. */
  readonly id: string
  /** Cheap enough to run on every health check (section 4.8). */
  health(ctx: AdapterContext): Promise<HealthReport>
}

/** A file or document as a connector fetched it. */
export interface SourceContent {
  filename: string
  mimeType: string
  data: Uint8Array
  sourceUrl?: string
}

// Verification

export type Verdict = 'verified' | 'false' | 'unverified'

export interface ClaimForVerification {
  id: string
  title: string
  statement: string
  summary?: string
  tags: readonly string[]
  url: string
}

export interface VerdictUpdate {
  externalId: string
  verdict: Verdict
  rationale?: string
  verifiedAt?: string
}

export interface VerificationProvider extends Adapter {
  /** Sends a claim out and returns its reference in the outside system. */
  submit(
    claim: ClaimForVerification,
    ctx: AdapterContext,
  ): Promise<{ externalId: string; url?: string }>
  /** Verdicts changed since a saved position, and the position to save next. */
  pull(
    since: string | null,
    ctx: AdapterContext,
  ): Promise<{ updates: VerdictUpdate[]; position: string | null }>
  /** Handles a push from the outside system, for services that send them. */
  receive?(body: unknown, headers: Headers, ctx: AdapterContext): Promise<VerdictUpdate[]>
}

// Ingestion

export interface SourceItem {
  id: string
  title?: string
}

export interface SourceConnector extends Adapter {
  readonly mode: 'manual' | 'pull' | 'push'
  /** Items waiting, for pull connectors. */
  list?(
    since: string | null,
    ctx: AdapterContext,
  ): Promise<{ items: SourceItem[]; position: string | null }>
  fetch(item: SourceItem, ctx: AdapterContext): Promise<SourceContent>
}

export interface ContentExtractor extends Adapter {
  /** MIME types it reads. The most specific match wins. */
  readonly accepts: readonly string[]
  extract(
    content: SourceContent,
    ctx: AdapterContext,
  ): Promise<{ text: string; pageCount: number | null; metadata: Record<string, unknown> }>
}

export interface StructuredImporter extends Adapter {
  readonly accepts: readonly string[]
  /** Reads headings and sample rows without saving anything. */
  inspect(
    content: SourceContent,
    ctx: AdapterContext,
  ): Promise<{ headings: string[]; sampleRows: string[][] }>
  /** Creates or updates records, mapping each record field to a column heading. */
  import(
    content: SourceContent,
    mapping: Readonly<Record<string, string>>,
    ctx: AdapterContext,
  ): Promise<{ created: number; updated: number; errors: { row: number; message: string }[] }>
}

// AI

export interface LLMRequest {
  model: string
  system: string
  prompt: string
  /** JSON Schema for the structured output. The caller validates the result. */
  outputSchema: Readonly<Record<string, unknown>>
}

export interface LLMProvider extends Adapter {
  readonly models: readonly string[]
  generate(request: LLMRequest, ctx: AdapterContext): Promise<unknown>
}

// Public site

export type SearchResultKind = 'area' | 'actor' | 'claim' | 'topic'

export interface SearchScope {
  locale: string
  country?: string
  limit?: number
}

export interface SearchResults {
  groups: { kind: SearchResultKind; items: { id: string; title: string; url: string }[] }[]
}

export interface SearchProvider extends Adapter {
  search(query: string, scope: SearchScope, ctx: AdapterContext): Promise<SearchResults>
  resolvePlace(
    text: string,
    scope: SearchScope,
    ctx: AdapterContext,
  ): Promise<{ id: string; name: string }[]>
  index(record: { collection: string; id: string }, ctx: AdapterContext): Promise<void>
}

export interface NewsletterProvider extends Adapter {
  /** Starts a confirmed sign-up. Nothing is subscribed until confirmed. */
  subscribe(email: string, locale: string, ctx: AdapterContext): Promise<void>
  unsubscribe(email: string, ctx: AdapterContext): Promise<void>
}

/** Analytics events never carry personal data. */
export interface AnalyticsProvider extends Adapter {
  pageView(
    event: { path: string; locale: string; referrer?: string },
    ctx: AdapterContext,
  ): Promise<void>
  searchEvent(
    event: { query: string; locale: string; country?: string; resultCount: number },
    ctx: AdapterContext,
  ): Promise<void>
}

export interface CaptchaProvider extends Adapter {
  /** What the form shows. */
  challenge(ctx: AdapterContext): Promise<{ kind: string; data: Record<string, unknown> }>
  verify(
    token: string,
    request: { ip?: string; userAgent?: string },
    ctx: AdapterContext,
  ): Promise<boolean>
}

/** The adapter type each port takes. */
export interface PortAdapters {
  verification: VerificationProvider
  sourceConnector: SourceConnector
  contentExtractor: ContentExtractor
  structuredImporter: StructuredImporter
  llm: LLMProvider
  search: SearchProvider
  newsletter: NewsletterProvider
  analytics: AnalyticsProvider
  captcha: CaptchaProvider
}

export type PortName = keyof PortAdapters

/**
 * How many adapters run per port (section 4.1).
 * - exactlyOne: one runs. Core's adapter is the default and gives way to one
 *   from another plugin. With two or more others, the selector chooses.
 * - selectOne: any number installed, one chosen by the selector, or none.
 * - oneOrMore and any: every enabled adapter runs.
 */
export type Cardinality = 'exactlyOne' | 'selectOne' | 'oneOrMore' | 'any'

export interface PortSpec {
  name: string
  cardinality: Cardinality
  /** The variable that chooses between adapters, where there is one. */
  selector?: 'PT_VERIFICATION' | 'PT_LLM_MODEL'
}

export const PORTS = {
  verification: {
    name: 'VerificationProvider',
    cardinality: 'exactlyOne',
    selector: 'PT_VERIFICATION',
  },
  sourceConnector: { name: 'SourceConnector', cardinality: 'any' },
  contentExtractor: { name: 'ContentExtractor', cardinality: 'oneOrMore' },
  structuredImporter: { name: 'StructuredImporter', cardinality: 'any' },
  llm: { name: 'LLMProvider', cardinality: 'selectOne', selector: 'PT_LLM_MODEL' },
  search: { name: 'SearchProvider', cardinality: 'exactlyOne' },
  newsletter: { name: 'NewsletterProvider', cardinality: 'exactlyOne' },
  analytics: { name: 'AnalyticsProvider', cardinality: 'exactlyOne' },
  captcha: { name: 'CaptchaProvider', cardinality: 'exactlyOne' },
} as const satisfies Record<PortName, PortSpec>

export const PORT_NAMES = Object.keys(PORTS) as PortName[]
