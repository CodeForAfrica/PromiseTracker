import { checkContext, checkVerification, handleWebhook } from '@promisetracker/plugin-check'
import { getPayload } from './getPayload'

/**
 * `POST /api/plugins/check/webhook` (section 5.2). The route wraps this in
 * `pluginRoute`, which answers 503 while the plugin is disabled.
 */
export async function checkWebhook(request: Request): Promise<Response> {
  const payload = await getPayload()
  return handleWebhook(request, {
    payload,
    adapter: checkVerification,
    context: () => checkContext(payload),
  })
}
