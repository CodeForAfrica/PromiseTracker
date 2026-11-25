import { getHealth } from '@promisetracker/cms'

export const dynamic = 'force-dynamic'

/** Ready to take traffic: the database and file storage both answer. */
export async function GET() {
  // The database and file storage only. Plugins' services are never asked here (section 16.3).
  const { services } = await getHealth('required')
  const ready = Boolean(services.database?.healthy && services.storage?.healthy)
  return Response.json(
    { ready, services: { database: services.database, storage: services.storage } },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
