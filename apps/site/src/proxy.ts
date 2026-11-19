import { NextResponse } from 'next/server'

/**
 * Keeps a server out of search engines when PT_NOINDEX is set, as staging is
 * (section 16.1). The header is read at request time, so the one image built
 * from `main` serves staging and production alike.
 */
export const NOINDEX = 'noindex, nofollow'

/** True for "true", "1", "yes" or "on", in any case. */
export function noindexFrom(value: string | undefined): boolean {
  return /^(true|1|yes|on)$/i.test(value?.trim() ?? '')
}

export function proxy() {
  const response = NextResponse.next()
  if (noindexFrom(process.env.PT_NOINDEX)) response.headers.set('X-Robots-Tag', NOINDEX)
  return response
}

export const config = {
  // Every page, the admin and the API. Built files carry no links of their own.
  matcher: ['/((?!_next/static|_next/image).*)'],
}
