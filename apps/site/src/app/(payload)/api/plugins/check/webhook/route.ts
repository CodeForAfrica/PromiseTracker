import { checkWebhook, kernel } from '@promisetracker/cms'
import { pluginRoute } from '@promisetracker/kernel'

export const dynamic = 'force-dynamic'

/** Report events from Check (section 5.2). 503 while plugin-check is disabled. */
export const POST = pluginRoute(kernel, 'check', checkWebhook)
