import type { Health, ServiceHealth } from '@promisetracker/contract'
import { readEnabledPlugins } from '@promisetracker/kernel'
import type { Payload } from 'payload'

import { checkStorage } from './storage'

async function timed(check: () => Promise<{ kind: string }>): Promise<ServiceHealth> {
  const started = performance.now()
  try {
    const result = await check()
    return { healthy: true, latencyMs: Math.round(performance.now() - started), ...result }
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.name : 'Error',
    }
  }
}

/**
 * The state of the services the platform needs (section 16.3). The database
 * and file storage are required. Later issues add Tika, the AI provider and
 * Check, which can be down without the site going down.
 */
export async function getHealth(getPayload: () => Promise<Payload>): Promise<Health> {
  const [database, storage] = await Promise.all([
    timed(async () => {
      const payload = await getPayload()
      // Reading the migrations table proves the database answers and the
      // schema is in place. A health check runs without a user, so it
      // bypasses access rules on this internal collection only.
      await payload.count({ collection: 'payload-migrations', overrideAccess: true })
      return { kind: 'postgres' }
    }),
    timed(checkStorage),
  ])
  const required = [database, storage]
  return {
    status: required.every((s) => s.healthy) ? 'healthy' : 'unhealthy',
    plugins: { enabled: readEnabledPlugins() },
    services: { database, storage },
  }
}
