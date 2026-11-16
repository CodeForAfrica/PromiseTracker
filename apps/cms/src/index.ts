import type { Health } from '@promisetracker/contract'
import type { Transport } from '@promisetracker/sdk'
import { NotFoundError } from '@promisetracker/sdk'

import { handleV1 } from './api/v1'
import { getPayload } from './getPayload'
import { getHealth as checkHealth } from './health'

export { handleV1 } from './api/v1'
export { assertRuntimeEnv, databaseUrl } from './env'
export { ensureFirstAdmin } from './firstAdmin'
export { getPayload } from './getPayload'
export { firstPartyPlugins, kernel } from './kernel'
export { effectiveMethod, gateRest, guestMayCall } from './restGate'
export { startPayload } from './startup'

const HEALTH_CACHE_MS = 5_000
let lastHealth: { at: number; result: Promise<Health> } | undefined

/**
 * The health of this process's services, checked against its own Payload
 * instance. Results are reused for five seconds, so a load balancer probing
 * every second does not hit the database and the store on every probe.
 */
export function getHealth(): Promise<Health> {
  const now = Date.now()
  if (!lastHealth || now - lastHealth.at > HEALTH_CACHE_MS) {
    lastHealth = { at: now, result: checkHealth(getPayload) }
  }
  return lastHealth.result
}

/** The SDK transport that calls the platform in this process, with no network hop. */
export function createLocalTransport(): Transport {
  return {
    async get(path, query) {
      const result = await handleV1(await getPayload(), path, new URLSearchParams(query))
      if (result === undefined) throw new NotFoundError(path)
      return result
    },
  }
}
