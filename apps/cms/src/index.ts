import type { Health } from '@promisetracker/contract'
import type { Transport } from '@promisetracker/sdk'

import { handleV1 } from './api/v1'
import { getPayload } from './getPayload'
import type { HealthScope } from './health'
import { getHealth as checkHealth } from './health'

export { handleV1, languages, matchRoute } from './api/v1'
export type { AreaFamily } from './areaTree'
export { areaFamily } from './areaTree'
export {
  createHttpRefresher,
  REVALIDATE_PATH,
  readRefreshRequest,
  SIGNATURE_HEADER,
  sign,
  verify,
  webUrl,
} from './cache'
export { assertRuntimeEnv, databaseUrl } from './env'
export { ensureFirstAdmin } from './firstAdmin'
export { getPayload } from './getPayload'
export { firstPartyPlugins, kernel } from './kernel'
export { checkWebhook } from './plugins'
export { effectiveMethod, gateRest, guestMayCall } from './restGate'
export { startPayload } from './startup'

const HEALTH_CACHE_MS = 5_000
const lastHealth = new Map<HealthScope, { at: number; result: Promise<Health> }>()

/**
 * The health of this process's services, checked against its own Payload
 * instance. Results are reused for five seconds, so a load balancer probing
 * every second does not hit the database and the store on every probe.
 * `required` checks the database and file storage alone, for the readiness
 * check: a plugin's service being down never stops the site taking traffic.
 */
export function getHealth(scope: HealthScope = 'all'): Promise<Health> {
  const now = Date.now()
  const last = lastHealth.get(scope)
  if (last && now - last.at <= HEALTH_CACHE_MS) return last.result
  const result = checkHealth(getPayload, scope)
  lastHealth.set(scope, { at: now, result })
  return result
}

/** The SDK transport that calls the platform in this process, with no network hop. */
export function createLocalTransport(): Transport {
  return {
    async get(path, query) {
      const result = await handleV1(await getPayload(), path, new URLSearchParams(query))
      return result ?? { status: 404, body: { error: 'not-found' } }
    },
  }
}
