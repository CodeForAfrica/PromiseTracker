import { createKernel } from '@promisetracker/kernel'
import { corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'

/**
 * Every first-party plugin, enabled or not. Their record types and fields are
 * always in the schema (D29). PT_PLUGINS decides which ones act.
 */
export const firstPartyPlugins = [corePlugin, sitePlugin] as const

/** Built once per process. A configuration problem stops start-up here. */
export const kernel = createKernel({ plugins: firstPartyPlugins })
