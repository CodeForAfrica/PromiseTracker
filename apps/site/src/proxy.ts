import { NextResponse } from 'next/server'

import { NOINDEX, noindexFrom } from './noindex'

/**
 * Keeps a server out of search engines when PT_NOINDEX is set, as staging is
 * (section 16.1). The header is read at request time, so the one image built
 * from `main` serves staging and production alike.
 */
export function proxy() {
  const response = NextResponse.next()
  if (noindexFrom(process.env.PT_NOINDEX)) response.headers.set('X-Robots-Tag', NOINDEX)
  return response
}

export const config = {
  // Pages and the admin. Not the API: Next.js buffers the body of every request
  // the proxy sees and cuts it at 10 MB, which would break larger uploads.
  // Search engines index pages, not JSON. Nor built files, which link nowhere.
  matcher: ['/((?!api/|_next/static|_next/image).*)'],
}
