import type {
  AnalyticsProvider,
  CaptchaProvider,
  ContentExtractor,
  NewsletterProvider,
  SearchProvider,
  SourceConnector,
  VerificationProvider,
} from '@promisetracker/kernel'

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

export const uploadConnector: SourceConnector = {
  id: 'upload',
  mode: 'manual',
  health: healthy,
  fetch: notYet('upload connector', '#652 (V1-14)'),
}

const decoder = new TextDecoder('utf-8')

/** Reads plain text as it is. Other formats come from plugin-tika. */
export const plaintextExtractor: ContentExtractor = {
  id: 'plaintext',
  accepts: ['text/plain', 'text/markdown', 'text/csv'],
  health: healthy,
  extract: async (content) => ({
    text: decoder.decode(content.data),
    pageCount: null,
    metadata: {},
  }),
}

export const payloadSearch: SearchProvider = {
  id: 'payload-search',
  health: healthy,
  search: notYet('payload-search', '#656 (V1-18)'),
  resolvePlace: notYet('payload-search', '#656 (V1-18)'),
  index: notYet('payload-search', '#656 (V1-18)'),
}

export const localNewsletter: NewsletterProvider = {
  id: 'local',
  health: healthy,
  subscribe: notYet('local newsletter', '#658 (V1-20)'),
  unsubscribe: notYet('local newsletter', '#658 (V1-20)'),
}

/** Sends nothing. Searches with no results are still logged locally (section 18). */
export const noAnalytics: AnalyticsProvider = {
  id: 'none',
  health: healthy,
  pageView: async () => {},
  searchEvent: async () => {},
}

export const localCaptcha: CaptchaProvider = {
  id: 'local',
  health: healthy,
  challenge: notYet('local captcha', '#658 (V1-20)'),
  verify: notYet('local captcha', '#658 (V1-20)'),
}
