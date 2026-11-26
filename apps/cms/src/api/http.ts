import { createHash } from 'node:crypto'

import { openApiDocument } from '@promisetracker/contract'
import type { Payload } from 'payload'

import { captchaChallenge, handleForm, inputOf, inputOfFormData } from './forms'
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
  return send(request, text, etagOf(text), status)
}

function send(request: Request, text: string, tag: string, status: number): Response {
  const headers = { 'Cache-Control': READ_CACHE, ETag: tag }
  // 304 means "the representation you hold is still right". Only a 200 can be
  // that: answering 304 to a 404 would tell a client with `If-None-Match: *`
  // that a missing record exists.
  if (status === 200 && matches(request.headers.get('if-none-match'), tag)) {
    return new Response(null, { status: 304, headers })
  }
  return new Response(text, {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

// The description is built from the contract, so it is the same until the
// next deploy. Build it, and hash it, once.
let openApi: { text: string; etag: string } | undefined
function openApiText(): { text: string; etag: string } {
  if (!openApi) {
    const text = JSON.stringify(openApiDocument())
    openApi = { text, etag: etagOf(text) }
  }
  return openApi
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
    if (path === '/openapi.json') {
      const { text, etag } = openApiText()
      return send(request, text, etag, 200)
    }
    if (path === '/captcha') {
      // Each challenge is used once, so none is ever cached.
      return uncached(await captchaChallenge(await getPayload()), 200)
    }
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

/** The most a form body may be: three files and the text around them. */
const MAX_FORM_BYTES = 31 * 1024 * 1024

/** How many proxies in front of the app add to `X-Forwarded-For`. Dokku's nginx is one. */
export function proxyHops(env: Readonly<Record<string, string | undefined>> = process.env): number {
  const hops = Number(env.PT_PROXY_HOPS?.trim() || '1')
  return Number.isInteger(hops) && hops >= 1 ? hops : 1
}

/**
 * The sender's address, used only for the captcha's rate limit. Each proxy
 * appends the address it saw to `X-Forwarded-For`, so the entries a sender
 * wrote come first and cannot be trusted. The one to use is the entry the
 * outermost trusted proxy added: `PT_PROXY_HOPS` from the end. Reading the
 * first entry instead would let a sender pick a new key for every request and
 * step around the limit.
 */
export function senderOf(
  request: Pick<Request, 'headers'>,
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  const entries = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  // Fewer entries than proxies means the request skipped some: the earliest is the nearest we have.
  const forwarded = entries[Math.max(0, entries.length - proxyHops(env))]
  const ip = forwarded || request.headers.get('x-real-ip')?.trim() || undefined
  const userAgent = request.headers.get('user-agent') ?? undefined
  return { ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) }
}

/**
 * The body's bytes, counted as they arrive. Null once it passes `limit`, so a
 * chunked body with no Content-Length cannot be buffered without end.
 */
async function readLimited(
  request: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/** Answers a POST to `/api/v1{path}`: the forms (section 12.1). Never cached. */
export async function respondForm(
  request: Request,
  path: string,
  getPayload: () => Promise<Payload>,
): Promise<Response> {
  try {
    const length = Number(request.headers.get('content-length') ?? 0)
    if (length > MAX_FORM_BYTES) return uncached({ error: 'files' }, 413)
    const body = await readLimited(request, MAX_FORM_BYTES)
    if (!body) return uncached({ error: 'files' }, 413)
    const type = request.headers.get('content-type') ?? ''
    // Parsed from the bytes already read, so no body is ever buffered past the limit.
    const parsed = new Response(body, { headers: { 'content-type': type } })
    const input = type.includes('application/json')
      ? inputOf(((await parsed.json().catch(() => null)) ?? {}) as Record<string, unknown>)
      : inputOfFormData(await parsed.formData().catch(() => new FormData()))
    const result = await handleForm(await getPayload(), path, input, senderOf(request))
    if (result === undefined) return uncached({ error: 'not-found' }, 404)
    return uncached(result.body, result.status)
  } catch (error) {
    console.error(`POST /api/v1${path} failed`, error)
    return uncached({ error: 'Internal server error' }, 500)
  }
}
