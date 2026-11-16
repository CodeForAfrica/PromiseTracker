import type { Payload } from 'payload'
import { getPayload as getPayloadInstance } from 'payload'

import { assertRuntimeEnv } from './env'
import config from './payload.config'

/** The one Payload instance for this process. */
export const getPayload = (): Promise<Payload> => {
  assertRuntimeEnv()
  return getPayloadInstance({ config })
}
