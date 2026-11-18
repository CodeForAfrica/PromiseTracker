import { readRefreshRequest, SIGNATURE_HEADER } from '@promisetracker/cms'
import { revalidateTag } from 'next/cache'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Refreshes cached pages by tag (section 17, D47). The platform calls it after
 * a change, from this process or from the worker. The request is signed with
 * the application secret.
 */
export async function POST(request: Request) {
  const body = await request.text()
  const tags = readRefreshRequest(
    body,
    request.headers.get(SIGNATURE_HEADER),
    process.env.PAYLOAD_SECRET ?? '',
  )
  if (!tags) return Response.json({ error: 'forbidden' }, { status: 403, headers })
  // Expire at once, so the next visitor gets the new page rather than the old one.
  for (const tag of tags) revalidateTag(tag, { expire: 0 })
  return Response.json({ revalidated: tags }, { headers })
}
