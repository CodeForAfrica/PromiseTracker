import { getHealth } from '@promisetracker/cms'

export const dynamic = 'force-dynamic'

/** The enabled plugins and the state of each service. Section 16.3. */
export async function GET() {
  const health = await getHealth()
  return Response.json(health, {
    status: health.status === 'unhealthy' ? 503 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
