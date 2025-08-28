import { BasePayload, getPayload } from 'payload'
import config from '@/payload.config'

export const getGlobalPayload = async (): Promise<BasePayload> => {
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  return payload
}
