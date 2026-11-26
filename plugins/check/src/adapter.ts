import type {
  AdapterContext,
  ClaimForVerification,
  VerdictUpdate,
  VerificationProvider,
} from '@promisetracker/kernel'
import { ConfigurationError, circuitBreakerFor, createLog } from '@promisetracker/kernel'
import type { CallOptions, CheckItem, Report } from './client'
import { createItem, getItem, itemId, itemsWithReport, readReport, SERVICE } from './client'
import type { CheckSettings } from './settings'
import { readCheckSettings } from './settings'

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const text = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function credentialsOf(settings: CheckSettings) {
  if (!settings.credentials) {
    throw new ConfigurationError(
      'The Check plugin has no workspace or API key. Fill them in under Settings, Check.',
    )
  }
  return settings.credentials
}

/** What Check shows under the claim: its title and summary, with a link back. */
export function claimDescription(claim: ClaimForVerification): string {
  const lead = claim.summary ? `${claim.title}: ${claim.summary}` : claim.title
  return claim.url ? `${lead}\n\n${claim.url}` : lead
}

const httpsOnly = (url: string | null): string | undefined =>
  url && /^https:\/\/\S+$/.test(url) ? url : undefined

/**
 * The verdict update a report gives, or none. A published report applies the
 * verdict mapped from the item's status. A paused one withdraws it. Anything
 * else leaves the claim in review (section 5.2).
 */
export function updateFrom(
  item: Pick<CheckItem, 'id' | 'status'>,
  report: Report | null,
  settings: CheckSettings,
  ctx: Pick<AdapterContext, 'logger'>,
): VerdictUpdate | null {
  const state = report?.state
  if (state === 'paused') return { externalId: item.id, verdict: 'unverified', withdrawn: true }
  if (state !== 'published' || !report) return null
  const verdict = item.status ? settings.statuses.get(item.status) : undefined
  if (!verdict) {
    // Start-up checks the mapping, so this is a status added in Check since.
    createLog(ctx.logger, 'check').error('A published Check report has a status with no verdict', {
      ids: { checkItem: item.id },
      status: item.status,
    })
    return null
  }
  const reportUrl = httpsOnly(report.url)
  return {
    externalId: item.id,
    verdict,
    ...(report.text ? { rationale: report.text } : {}),
    ...(report.publishedAt ? { verifiedAt: report.publishedAt } : {}),
    ...(reportUrl ? { reportUrl } : {}),
  }
}

/** The webhook's body, as section 5.2 describes it: the fields the plugin reads. */
export function readWebhook(body: unknown): {
  annotationType: string | null
  dbid: string | null
  report: Report | null
} {
  const object = asRecord(asRecord(body).object)
  const annotatedType = text(object.annotated_type)
  return {
    annotationType: text(object.annotation_type),
    dbid:
      annotatedType === null || annotatedType === 'ProjectMedia' ? text(object.annotated_id) : null,
    report: readReport(object.data),
  }
}

/**
 * The `check` verification adapter (section 5.2). Claims go out as Check items
 * of type Claim, and verdicts come back from published reports, by webhook and
 * by a poll every 15 minutes.
 */
export function createCheckVerification(options: CallOptions = {}): VerificationProvider {
  const callOptions = (ctx: AdapterContext): CallOptions => ({
    ...options,
    signal: ctx.signal,
    log: createLog(ctx.logger, 'check'),
  })
  return {
    id: 'check',
    reference: { externalId: 'check.itemId', url: 'check.itemUrl', syncedAt: 'check.syncedAt' },

    async health(ctx) {
      const settings = readCheckSettings(ctx.settings)
      if (!settings.credentials) return { healthy: false, detail: 'No workspace or API key.' }
      // Reports what the breaker knows rather than calling Check on every probe.
      const state = circuitBreakerFor(SERVICE).state
      return state === 'open'
        ? { healthy: false, detail: 'Calls to Check are paused after repeated failures.' }
        : { healthy: true }
    },

    async submit(claim, ctx) {
      const credentials = credentialsOf(readCheckSettings(ctx.settings))
      const created = await createItem(
        credentials,
        { quote: claim.statement, description: claimDescription(claim), tags: claim.tags },
        callOptions(ctx),
      )
      return { externalId: created.id, ...(created.url ? { url: created.url } : {}) }
    },

    async pull(_since, ctx) {
      const settings = readCheckSettings(ctx.settings)
      const credentials = credentialsOf(settings)
      const published = await itemsWithReport(credentials, 'published', callOptions(ctx))
      // A lost pause is caught too, or the claim would stay verified and public.
      const paused = await itemsWithReport(credentials, 'paused', callOptions(ctx))
      const updates = [
        ...published
          .map((item) => updateFrom(item, item.report, settings, ctx))
          .filter((update): update is VerdictUpdate => update !== null),
        ...paused.map(
          (item): VerdictUpdate => ({
            externalId: item.id,
            verdict: 'unverified',
            withdrawn: true,
          }),
        ),
      ]
      // A search of every report needs no saved position.
      return { updates, position: null }
    },

    async receive(body, _headers, ctx) {
      const settings = readCheckSettings(ctx.settings)
      const { annotationType, dbid, report } = readWebhook(body)
      if (annotationType !== 'report_design' || !dbid) return []
      if (report?.state === 'paused') {
        return [{ externalId: itemId(dbid), verdict: 'unverified', withdrawn: true }]
      }
      if (report?.state !== 'published') return []
      // The webhook carries the report, not the item's status, so that is read from Check.
      const item = await getItem(credentialsOf(settings), dbid, callOptions(ctx))
      if (!item) return []
      const update = updateFrom(item, report, settings, ctx)
      return update ? [update] : []
    },
  }
}

export const checkVerification = createCheckVerification()
