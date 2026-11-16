import { getPayload as getPayloadInstance } from 'payload'

import config from './payload.config'

/** The one Payload instance for this process. */
export const getPayload = () => getPayloadInstance({ config })
