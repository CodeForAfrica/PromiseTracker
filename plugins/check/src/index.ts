import type { AdapterContext } from '@promisetracker/kernel'
import { definePromiseTrackerPlugin, readSettings } from '@promisetracker/kernel'
import { fromLiveGroup } from '@promisetracker/plugin-core'
import type { Field, Payload, PayloadRequest } from 'payload'
import { checkVerification } from './adapter'
import { checkStatusMapping, settingsFields } from './settings'
import { pollCheck } from './webhook'

/** The plugin's settings, read as the kernel reads them for an adapter. */
async function checkContext(payload: Payload): Promise<AdapterContext> {
  const settings: unknown = Reflect.get(await readSettings(payload), 'check')
  return {
    payload,
    logger: payload.logger,
    signal: new AbortController().signal,
    settings: settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {},
  }
}

// Written by the plugin to the live claim, so the admin reads them from there.
const liveField = (field: Field & { name: string }): Field =>
  ({ ...field, hooks: { afterRead: [fromLiveGroup('check', field.name)] } }) as Field

/** The read-only `check` group on claims (section 5.2). */
const claimFields: Field[] = [
  liveField({ name: 'itemId', label: 'Check item', type: 'text', index: true }),
  liveField({ name: 'itemUrl', label: 'Open in Check', type: 'text' }),
  liveField({
    name: 'reportState',
    label: 'Report',
    type: 'select',
    options: [
      { label: 'Published', value: 'published' },
      { label: 'Paused', value: 'paused' },
    ],
  }),
  liveField({
    name: 'syncedAt',
    label: 'Last synced',
    type: 'date',
    admin: { date: { pickerAppearance: 'dayAndTime' } },
  }),
  liveField({
    name: 'syncResult',
    label: 'Last sync',
    type: 'select',
    options: [
      { label: 'Verdict applied', value: 'applied' },
      { label: 'No change', value: 'unchanged' },
    ],
  }),
]

/**
 * plugin-check: verification in Meedan Check (section 5.2). Claims go to the
 * Check workspace when created, and the verdict, date and rationale come back
 * from published reports, which the plugin then owns (section 4.5).
 */
export const checkPlugin = definePromiseTrackerPlugin({
  slug: 'check',
  version: '0.1.0',
  order: 30,
  dependsOn: ['core'],
  extend: [{ collection: 'claims', fields: claimFields }],
  takesOver: [
    {
      collection: 'claims',
      fields: [
        'verification.verdict',
        'verification.date',
        'verification.rationale',
        'verification.reportUrl',
      ],
    },
  ],
  provides: { verification: [checkVerification] },
  settings: settingsFields,
  routes: [
    { path: 'webhook', methods: ['POST'], description: 'Report events from Check (section 5.2)' },
  ],
  tasks: [
    {
      slug: 'pollCheck',
      // A push can be lost during a deploy, and this catches it (section 5.2).
      schedule: [{ cron: '*/15 * * * *', queue: 'default' }],
      retries: 2,
      handler: async ({ req }: { req: PayloadRequest }) => {
        const output = await pollCheck({
          payload: req.payload,
          adapter: checkVerification,
          context: () => checkContext(req.payload),
        })
        return { output }
      },
    } as never,
  ],
  checkSettings: (ctx) => checkStatusMapping(ctx),
})

export {
  checkVerification,
  claimDescription,
  createCheckVerification,
  readWebhook,
  updateFrom,
} from './adapter'
export * from './client'
export { checkStatusMapping, DEFAULT_STATUS_MAP, readCheckSettings } from './settings'
export type { WebhookDeps } from './webhook'
export {
  FINGERPRINT_TTL_MS,
  forgetDeliveries,
  handleWebhook,
  pollCheck,
  secretMatches,
} from './webhook'

/** For the route under `/api/plugins/check/webhook`. */
export { checkContext }
