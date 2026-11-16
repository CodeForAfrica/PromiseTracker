import type { Transport } from '@promisetracker/sdk'
import { NotFoundError } from '@promisetracker/sdk'

import { handleV1 } from './api/v1'
import { getPayload } from './getPayload'
import { getHealth as getHealthWith } from './health'

export { handleV1 } from './api/v1'
export { databaseUrl } from './env'
export { getPayload } from './getPayload'

export const getHealth = () => getHealthWith(getPayload)

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
