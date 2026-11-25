import type { Health, ServiceHealth } from '@promisetracker/contract'
import type { Kernel, PortAdapters } from '@promisetracker/kernel'
import type { Payload } from 'payload'

import { kernel } from './kernel'
import { checkStorage } from './storage'

type Adapter = PortAdapters[keyof PortAdapters]

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

export type HealthScope = 'all' | 'required'

/**
 * The services enabled plugins bring, such as Tika, each under its plugin's
 * name. One can be down without the site going down: the health check reports
 * `degraded`, and the readiness check never asks.
 */
export async function pluginServices(
  payload: Payload,
  from: Pick<Kernel, 'manifests' | 'isEnabled' | 'context'> = kernel,
): Promise<Record<string, ServiceHealth>> {
  const checks = from.manifests
    .filter((m) => m.slug !== 'core' && from.isEnabled(m.slug))
    .map((m) => {
      const adapters = Object.values(m.provides ?? {}).flat() as readonly Adapter[]
      return { slug: m.slug, adapters }
    })
    .filter(({ adapters }) => adapters.length > 0)
  const entries = await Promise.all(
    checks.map(async ({ slug, adapters }) => {
      const started = performance.now()
      const failure = (error: unknown) => ({
        healthy: false,
        detail: error instanceof Error ? error.name : 'Error',
      })
      // Reading a plugin's settings can fail too, such as before its
      // migration has run. That plugin is down, and the rest still report.
      const reports = await from.context(payload, slug).then(
        (ctx) => Promise.all(adapters.map((a) => a.health(ctx).catch(failure))),
        (error: unknown) => [failure(error)],
      )
      const failed = reports.find((r) => !r.healthy)
      const health: ServiceHealth = {
        healthy: !failed,
        latencyMs: Math.round(performance.now() - started),
        kind: slug,
        // The detail says why without naming the address (section 13.7).
        ...(failed?.detail ? { error: failed.detail } : {}),
      }
      return [slug, health] as const
    }),
  )
  return Object.fromEntries(entries)
}

/**
 * The state of the services the platform needs (section 16.3). The database
 * and file storage are required. Plugins' services, such as Tika, are reported
 * too, and can be down without the site going down.
 */
export async function getHealth(
  getPayload: () => Promise<Payload>,
  scope: HealthScope = 'all',
): Promise<Health> {
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
  const optional =
    scope === 'all' && database.healthy ? await pluginServices(await getPayload()) : {}
  const status = !required.every((s) => s.healthy)
    ? 'unhealthy'
    : Object.values(optional).every((s) => s.healthy)
      ? 'healthy'
      : 'degraded'
  return {
    status,
    plugins: { enabled: [...kernel.enabled] },
    ports: kernel.ports(),
    services: { database, storage, ...optional },
  }
}
