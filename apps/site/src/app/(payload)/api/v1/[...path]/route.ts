import { getPayload, handleV1 } from '@promisetracker/cms'

type Args = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, { params }: Args) {
  const { path } = await params
  const route = `/${path.join('/')}`
  const result = await handleV1(await getPayload(), route, new URL(request.url).searchParams)
  if (result === undefined) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(result)
}
