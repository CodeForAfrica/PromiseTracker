import { getPayload, respondV1 } from '@promisetracker/cms'

// Every request is answered fresh. Each response carries Cache-Control and an
// ETag, so a cache in front checks back and gets a 304 when nothing changed.
export const dynamic = 'force-dynamic'

type Args = { params: Promise<{ path: string[] }> }

/** `/api/v1` (section 12). The answers come from `@promisetracker/cms`, which tests them. */
export async function GET(request: Request, { params }: Args) {
  const { path } = await params
  return respondV1(request, `/${path.join('/')}`, getPayload)
}
