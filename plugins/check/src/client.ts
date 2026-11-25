import type { SourceLog } from '@promisetracker/kernel'
import { circuitBreakerFor, ExternalServiceError, withRetry } from '@promisetracker/kernel'

/**
 * Meedan Check's GraphQL API (section 5.2), from v2's `src/lib/meedan.ts`.
 * Every call goes through the `check` circuit breaker and retries as section
 * 9.7 says, waiting for `Retry-After` on a 429.
 */

export const CHECK_API = 'https://check-api.checkmedia.org/api/graphql'
export const SERVICE = 'check'
/** Items per page when searching for published reports (section 5.2). */
export const PAGE_SIZE = 100
/** Calls to Check are short. One that hangs is abandoned. */
const TIMEOUT_MS = 30_000

export type CheckCredentials = {
  /** The workspace's slug, which Check reads from `X-Check-Team`. */
  workspace: string
  apiKey: string
}

export type CallOptions = {
  signal?: AbortSignal
  log?: SourceLog
  /** For tests: the API's address and the fetch to call it with. */
  endpoint?: string
  fetch?: typeof fetch
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

type GraphQLResponse = { data?: unknown; errors?: { message?: string }[] }

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

/** One GraphQL call, with the workspace's key in the headers. */
export async function checkGraphQL(
  credentials: CheckCredentials,
  operation: string,
  query: string,
  variables: Record<string, unknown>,
  options: CallOptions = {},
): Promise<Record<string, unknown>> {
  const call = options.fetch ?? fetch
  return withRetry(
    async (signal) => {
      let response: Response
      try {
        response = await call(options.endpoint ?? CHECK_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Check-Token': credentials.apiKey,
            'X-Check-Team': credentials.workspace,
          },
          body: JSON.stringify({ query, variables }),
          signal,
        })
      } catch (error) {
        throw ExternalServiceError.fromCause(SERVICE, error)
      }
      if (!response.ok) throw ExternalServiceError.fromResponse(SERVICE, response)
      const body = (await response.json().catch(() => null)) as GraphQLResponse | null
      if (!body) {
        throw new ExternalServiceError('Check answered with something that is not JSON.', {
          service: SERVICE,
          failure: 'invalid-response',
        })
      }
      if (body.errors?.length) {
        const messages = body.errors.map((e) => e.message ?? 'unknown error').join('; ')
        throw new ExternalServiceError(`Check refused ${operation}: ${messages}`, {
          service: SERVICE,
          failure: 'invalid-response',
        })
      }
      return asRecord(body.data)
    },
    {
      service: SERVICE,
      operation: `Check ${operation}`,
      timeoutMs: TIMEOUT_MS,
      breaker: circuitBreakerFor(SERVICE),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.log ? { log: options.log } : {}),
      ...(options.sleep ? { sleep: options.sleep } : {}),
    },
  )
}

const text = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const CREATE_ITEM = `
  mutation createProjectMedia($input: CreateProjectMediaInput!) {
    createProjectMedia(input: $input) {
      project_media { id full_url status }
    }
  }
`

export type NewItem = {
  quote: string
  description: string
  tags: readonly string[]
}

/**
 * Creates a Check item of type Claim (section 5.2). It sets no status, so the
 * item starts on the workspace's default, which may not be `undetermined` (D90).
 */
export async function createItem(
  credentials: CheckCredentials,
  item: NewItem,
  options: CallOptions = {},
): Promise<{ id: string; url: string | null }> {
  const data = await checkGraphQL(
    credentials,
    'createProjectMedia',
    CREATE_ITEM,
    {
      input: {
        media_type: 'Claim',
        quote: item.quote,
        channel: { main: 1 },
        set_tags: [...item.tags],
        set_claim_description: item.description,
      },
    },
    options,
  )
  const media = asRecord(asRecord(data.createProjectMedia).project_media)
  const id = text(media.id)
  if (!id) {
    throw new ExternalServiceError('Check created an item but gave no id.', {
      service: SERVICE,
      failure: 'invalid-response',
    })
  }
  return { id, url: text(media.full_url) }
}

/** An item as the plugin reads it: its status, and its report if it has one. */
export type CheckItem = {
  id: string
  url: string | null
  status: string | null
  reportStatus: string | null
  report: Report | null
}

export type Report = {
  state: string | null
  text: string | null
  url: string | null
  publishedAt: string | null
}

/** Reads a report's design annotation, which Check gives as JSON or as a string of it. */
export function readReport(data: unknown): Report | null {
  let value: unknown = data
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const record = asRecord(value)
  if (Object.keys(record).length === 0) return null
  // Check keeps the report's fields in `options`, a list of one per language
  // in older workspaces and a single object in newer ones.
  const options = Array.isArray(record.options)
    ? asRecord(record.options[0])
    : asRecord(record.options)
  return {
    state: text(record.state),
    text: text(options.text) ?? text(options.description) ?? text(options.headline),
    url: text(options.published_article_url),
    publishedAt: toIso(record.last_published),
  }
}

/** Check sends times as seconds since 1970, as a number or a string, or as ISO dates. */
export function toIso(value: unknown): string | null {
  const raw = text(value)
  if (!raw) return null
  const seconds = /^\d+$/.test(raw) ? Number(raw) : null
  const date = seconds === null ? new Date(raw) : new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const ITEM_FIELDS = `
  id
  full_url
  status
  report_status
  report: annotation(annotation_type: "report_design") { data }
`

function readItem(node: unknown): CheckItem | null {
  const record = asRecord(node)
  const id = text(record.id)
  if (!id) return null
  return {
    id,
    url: text(record.full_url),
    status: text(record.status),
    reportStatus: text(record.report_status),
    report: readReport(asRecord(record.report).data),
  }
}

const ITEM = `
  query ProjectMedia($ids: String!) {
    project_media(ids: $ids) { ${ITEM_FIELDS} }
  }
`

/** One item, by its number in Check's database. Null when Check has no such item. */
export async function getItem(
  credentials: CheckCredentials,
  dbid: string,
  options: CallOptions = {},
): Promise<CheckItem | null> {
  const data = await checkGraphQL(credentials, 'project_media', ITEM, { ids: dbid }, options)
  return readItem(data.project_media)
}

const PUBLISHED = `
  query PublishedReports($query: String!) {
    search(query: $query) {
      number_of_results
      medias { edges { node { ${ITEM_FIELDS} } } }
    }
  }
`

/**
 * Check's search reads at most 10,000 results deep (its `window_size`), so a
 * poll reads at most that many. Results come most recently active first, so a
 * report whose webhook was lost is near the top, and one deeper down has not
 * changed since an earlier poll reconciled it (D92).
 */
export const SEARCH_WINDOW = 10_000
const MAX_PAGES = SEARCH_WINDOW / PAGE_SIZE

/** Items whose report is in a state, most recently active first, 100 per page (section 5.2). */
export async function itemsWithReport(
  credentials: CheckCredentials,
  state: 'published' | 'paused',
  options: CallOptions = {},
): Promise<CheckItem[]> {
  const items: CheckItem[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = JSON.stringify({
      report_status: [state],
      sort: 'recent_activity',
      sort_type: 'desc',
      eslimit: PAGE_SIZE,
      esoffset: page * PAGE_SIZE,
    })
    const data = await checkGraphQL(credentials, 'search', PUBLISHED, { query }, options)
    const edges = asRecord(asRecord(data.search).medias).edges
    const nodes = Array.isArray(edges) ? edges.map((edge) => asRecord(edge).node) : []
    for (const node of nodes) {
      const item = readItem(node)
      if (item) items.push(item)
    }
    if (nodes.length < PAGE_SIZE) break
  }
  return items
}

/** Items with a published report. */
export const publishedItems = (credentials: CheckCredentials, options: CallOptions = {}) =>
  itemsWithReport(credentials, 'published', options)

const STATUSES = `
  query TeamStatuses {
    team { verification_statuses }
  }
`

/** The statuses the workspace defines, by id and label. Check manages them (D42). */
export async function workspaceStatuses(
  credentials: CheckCredentials,
  options: CallOptions = {},
): Promise<{ id: string; label: string }[]> {
  const data = await checkGraphQL(credentials, 'verification_statuses', STATUSES, {}, options)
  let statuses: unknown = asRecord(data.team).verification_statuses
  if (typeof statuses === 'string') {
    try {
      statuses = JSON.parse(statuses)
    } catch {
      statuses = {}
    }
  }
  const list = asRecord(statuses).statuses
  if (!Array.isArray(list)) {
    throw new ExternalServiceError('Check gave no list of statuses for the workspace.', {
      service: SERVICE,
      failure: 'invalid-response',
    })
  }
  return list.flatMap((status) => {
    const id = text(asRecord(status).id)
    return id ? [{ id, label: text(asRecord(status).label) ?? id }] : []
  })
}

/** The item's id in Check's GraphQL API: base64 of `ProjectMedia/{number}` (section 5.2). */
export const itemId = (dbid: string | number): string =>
  Buffer.from(`ProjectMedia/${dbid}`, 'utf8').toString('base64')
