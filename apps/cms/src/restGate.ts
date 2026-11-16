import { getPayload } from './getPayload'

/**
 * Payload's REST routes are for signed-in users (D46, section 13.1). Guests
 * read through /api/v1, which returns only the fields in the contract. A
 * guest may call only what signing in needs, password reset, and the files of
 * public media.
 *
 * Paths are as Payload sees them, after `/api`.
 */
const GUEST_ROUTES: readonly { method: string; path: RegExp }[] = [
  { method: 'POST', path: /^\/users\/login$/ },
  { method: 'POST', path: /^\/users\/logout$/ },
  { method: 'POST', path: /^\/users\/refresh-token$/ },
  // The admin asks who is signed in before it shows the sign-in form. A guest gets "nobody".
  { method: 'GET', path: /^\/users\/me$/ },
  { method: 'POST', path: /^\/users\/forgot-password$/ },
  { method: 'POST', path: /^\/users\/reset-password$/ },
  // Actor photos and article images. The gate only lets the request through.
  // Payload still applies the media record type's read rule, so making media
  // private there closes these files too.
  { method: 'GET', path: /^\/media\/file\/[^/]+$/ },
]

const API_PREFIX = '/api'

export function guestMayCall(method: string, path: string): boolean {
  // Trailing slashes are dropped without a regular expression, which a long
  // run of slashes from a hostile caller could slow down.
  let end = path.length
  while (end > 1 && path[end - 1] === '/') end -= 1
  const clean = path.slice(0, end)
  return GUEST_ROUTES.some((route) => route.method === method && route.path.test(clean))
}

/**
 * Payload treats a POST carrying one of these headers as a GET, which its
 * admin uses for long queries. The gate must judge the request as Payload
 * will handle it, or a guest could dress a GET up as an allowed POST.
 */
const METHOD_OVERRIDE_HEADERS = ['X-Payload-HTTP-Method-Override', 'X-HTTP-Method-Override']

export function effectiveMethod(request: Pick<Request, 'method' | 'headers'>): string {
  const method = request.method.toUpperCase()
  const overridden =
    method === 'POST' && METHOD_OVERRIDE_HEADERS.some((name) => request.headers.get(name) === 'GET')
  return overridden ? 'GET' : method
}

type Handler<TArgs extends unknown[]> = (
  request: Request,
  ...args: TArgs
) => Promise<Response> | Response

/** Wraps one of Payload's REST handlers so it refuses guests, with the exceptions above. */
export function gateRest<TArgs extends unknown[]>(handler: Handler<TArgs>): Handler<TArgs> {
  return async (request, ...args) => {
    const { pathname } = new URL(request.url)
    const path = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : pathname
    // A browser's preflight request carries no sign-in, and reads nothing.
    if (request.method === 'OPTIONS' || guestMayCall(effectiveMethod(request), path)) {
      return handler(request, ...args)
    }
    const payload = await getPayload()
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) {
      return Response.json(
        { errors: [{ message: 'Sign in to use this API.' }] },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return handler(request, ...args)
  }
}
