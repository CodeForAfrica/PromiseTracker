import type { AnalyticsProvider, VerificationProvider } from '@promisetracker/kernel'

/**
 * Core's default adapters (section 6.5). They need no outside service. Most
 * are stubs for now. Each stub names the issue that fills it in.
 */

const healthy = async () => ({ healthy: true })

const notYet = (adapter: string, issue: string) => () =>
  Promise.reject(new Error(`The ${adapter} adapter is not built yet. It comes with ${issue}.`))

export const nativeVerification: VerificationProvider = {
  id: 'native',
  health: healthy,
  submit: notYet('native verification', '#650 (V1-12)'),
  pull: notYet('native verification', '#650 (V1-12)'),
}

export { localCaptcha } from './captcha'
export { plaintextExtractor, uploadConnector, urlConnector } from './documents/connectors'
export { localNewsletter } from './forms'
export { payloadSearch } from './search'

/** Sends nothing. Searches with no results are still logged locally (section 18). */
export const noAnalytics: AnalyticsProvider = {
  id: 'none',
  health: healthy,
  pageView: async () => {},
  searchEvent: async () => {},
}
