import { createKernel } from '@promisetracker/kernel'
import { corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'

import { defaultLocale, registeredLocales } from './locales'

/**
 * Every first-party plugin, enabled or not. Their record types and fields are
 * always in the schema (D29). PT_PLUGINS decides which ones act.
 */
export const firstPartyPlugins = [corePlugin, sitePlugin] as const

/** Built once per process. A configuration problem stops start-up here. */
export const kernel = createKernel({
  plugins: firstPartyPlugins,
  locales: registeredLocales,
  defaultLocale,
})

/** The plugin that provides an adapter, whose settings the adapter is given (section 4.2). */
export const ownerOf = (adapter: object): string =>
  kernel.manifests.find((m) =>
    Object.values(m.provides ?? {}).some((list) => (list as readonly object[]).includes(adapter)),
  )?.slug ?? 'core'
