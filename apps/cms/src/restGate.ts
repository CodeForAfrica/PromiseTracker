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
  // Actor photos and article images. The media record type allows guests to read.
  { method: 'GET', path: /^\/media\/file\/[^/]+$/ },
]

const API_PREFIX = '/api'

export function guestMayCall(method: string, path: string): boolean {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  return GUEST_ROUTES.some((route) => route.method === method && route.path.test(clean))
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
    if (request.method === 'OPTIONS' || guestMayCall(request.method, path)) {
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
