import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * A recorded Check API (section 5.2). Each GraphQL operation answers with its
 * recording in `tests/fixtures/check-api`, and every request is kept, so a
 * test can read the headers and variables the plugin sent.
 */

const dir = path.resolve(import.meta.dirname, 'fixtures/check-api')

export const recording = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(dir, `${name}.json`), 'utf8'))

export type SentRequest = {
  operation: string
  headers: Headers
  variables: Record<string, unknown>
}

type Reply = unknown | ((request: SentRequest) => unknown | Response)

/** The operation's name, as `createProjectMedia` in `mutation createProjectMedia(...)`. */
const operationOf = (query: string): string =>
  /\b(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? 'unknown'

const RECORDINGS: Record<string, Reply> = {
  createProjectMedia: () => recording('createProjectMedia'),
  projectMedia: () => recording('project_media'),
  teamStatuses: () => recording('verification_statuses'),
  publishedReports: ({ variables }: SentRequest) => {
    const query = JSON.parse(String(variables.query)) as {
      esoffset?: number
      report_status?: string[]
    }
    if (query.report_status?.includes('paused')) return recording('search-paused')
    return recording(query.esoffset ? 'search-page-2' : 'search-page-1')
  },
}

export function recordedCheck(overrides: Record<string, Reply> = {}) {
  const sent: SentRequest[] = []
  const replies = { ...RECORDINGS, ...overrides }
  const fake = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string
      variables?: Record<string, unknown>
    }
    const request: SentRequest = {
      operation: operationOf(body.query),
      headers: new Headers(init?.headers),
      variables: body.variables ?? {},
    }
    sent.push(request)
    // Keys are the operation's name in camel case, as `projectMedia` for `ProjectMedia`.
    const key = request.operation.charAt(0).toLowerCase() + request.operation.slice(1)
    const reply = replies[key]
    if (reply === undefined) return Response.json({ errors: [{ message: 'Not recorded' }] })
    const value = typeof reply === 'function' ? reply(request) : reply
    return value instanceof Response ? value : Response.json(value)
  }) as typeof globalThis.fetch
  return { fetch: fake, sent, endpoint: 'https://check.test/api/graphql' }
}
