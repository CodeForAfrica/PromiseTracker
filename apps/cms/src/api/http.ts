import { createHash } from 'node:crypto'

import { openApiDocument } from '@promisetracker/contract'
import type { Payload } from 'payload'

import { handleV1 } from './v1'

/**
 * `/api/v1` over HTTP (section 12.2): the status and body from the handlers,
 * with `Cache-Control` and `ETag` on every read, and `304` when the caller
 * already holds the same body.
 */

/**
 * Caches may keep a response but must check it each time. The check is cheap:
 * a matching ETag answers `304` with no body. Publishing changes the body and
 * so the ETag, so a cache never serves a page that publishing has replaced.
 */
export const READ_CACHE = 'public, max-age=0, must-revalidate'
const NO_STORE = 'no-store'

/** A strong ETag from the exact bytes sent. */
export const etagOf = (body: string): string =>
  `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`

/** Whether `If-None-Match` names this ETag, compared weakly as RFC 9110 asks for GET. */
export function matches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false
  const bare = (tag: string) => tag.trim().replace(/^W\//, '')
  return ifNoneMatch.split(',').some((tag) => tag.trim() === '*' || bare(tag) === bare(etag))
}

function cached(request: Request, body: unknown, status: number): Response {
  const text = JSON.stringify(body)
  const etag = etagOf(text)
  const headers = { 'Cache-Control': READ_CACHE, ETag: etag }
  if (matches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(text, {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

const uncached = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { 'Cache-Control': NO_STORE } })

/** Answers a GET for `/api/v1{path}`. */
export async function respondV1(
  request: Request,
  path: string,
  getPayload: () => Promise<Payload>,
): Promise<Response> {
  try {
    if (path === '/openapi.json') return cached(request, openApiDocument(), 200)
    const query = new URL(request.url).searchParams
    const result = await handleV1(await getPayload(), path, query)
    if (result === undefined) return uncached({ error: 'not-found' }, 404)
    // A read and "not available in this language" are both answers worth
    // keeping. A bad request is not.
    if (result.status === 400) return uncached(result.body, 400)
    return cached(request, result.body, result.status)
  } catch (error) {
    // The public contract always answers in JSON. Details go to the log only.
    console.error(`GET /api/v1${path} failed`, error)
    return uncached({ error: 'Internal server error' }, 500)
  }
}
