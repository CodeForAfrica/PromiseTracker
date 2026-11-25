import { createKernel } from '@promisetracker/kernel'
import { aiPlugin } from '@promisetracker/plugin-ai'
import { corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'
import { tikaPlugin } from '@promisetracker/plugin-tika'

import { defaultLocale, registeredLocales } from './locales'

/**
 * Every first-party plugin, enabled or not. Their record types and fields are
 * always in the schema (D29). PT_PLUGINS decides which ones act.
 */
export const firstPartyPlugins = [corePlugin, sitePlugin, tikaPlugin, aiPlugin] as const

/** Built once per process. A configuration problem stops start-up here. */
export const kernel = createKernel({
  plugins: firstPartyPlugins,
  locales: registeredLocales,
  defaultLocale,
})
