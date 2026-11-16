import { getPayload, handleV1 } from '@promisetracker/cms'

// Responses are not cached yet. Caching comes with the public API work.
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store' }

type Args = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, { params }: Args) {
  const { path } = await params
  const route = `/${path.join('/')}`
  try {
    const result = await handleV1(await getPayload(), route, new URL(request.url).searchParams)
    if (result === undefined) {
      return Response.json({ error: 'Not found' }, { status: 404, headers })
    }
    return Response.json(result, { headers })
  } catch (error) {
    // The public contract always answers in JSON. Details go to the log only.
    console.error(`GET /api/v1${route} failed`, error)
    return Response.json({ error: 'Internal server error' }, { status: 500, headers })
  }
}
