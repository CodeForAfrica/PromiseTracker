import type { AdapterContext } from '@promisetracker/kernel'
import {
  applyManifest,
  ConfigurationError,
  createKernel,
  ExternalServiceError,
  resetCircuitBreakers,
} from '@promisetracker/kernel'
import {
  checkPlugin,
  checkStatusMapping,
  claimDescription,
  createCheckVerification,
  createItem,
  DEFAULT_STATUS_MAP,
  forgetDeliveries,
  handleWebhook,
  itemId,
  readReport,
  secretMatches,
  toIso,
} from '@promisetracker/plugin-check'
import { Claims, corePlugin } from '@promisetracker/plugin-core'
import { sitePlugin } from '@promisetracker/plugin-site'
import type { Config, Field, Payload } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { recordedCheck, recording } from '../check-api'

const settings = {
  workspace: 'promise-tracker',
  apiKey: 'test-api-key',
  webhookSecret: 'test-webhook-secret',
  statuses: DEFAULT_STATUS_MAP.map((row) => ({ ...row })),
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
const ctx = (own: Record<string, unknown> = settings): AdapterContext => ({
  payload: {} as Payload,
  logger,
  signal: new AbortController().signal,
  settings: own,
})

const noWait = async () => {}

const claim = {
  id: 'claim-1',
  title: 'Build 200 new health centres',
  statement: 'We will build 200 new health centres by 2027',
  summary: 'The governor promised 200 health centres.',
  tags: ['health', 'promise', 'ke'],
  url: 'https://promisetracker.example/en/ke/p/build-200-new-health-centres',
}

beforeEach(() => {
  resetCircuitBreakers()
  vi.clearAllMocks()
})

describe('the check adapter', () => {
  it('is chosen by PT_VERIFICATION=check', () => {
    const kernel = createKernel({
      plugins: [corePlugin, sitePlugin, checkPlugin],
      env: { PT_PLUGINS: 'core,site,check', PT_VERIFICATION: 'check' },
    })
    expect(kernel.adapters.verification.id).toBe('check')
    expect(kernel.adapters.verification.reference?.externalId).toBe('check.itemId')
  })

  it('takes over the verdict, date and rationale, and the report link', () => {
    expect(checkPlugin.manifest.takesOver).toEqual([
      {
        collection: 'claims',
        fields: [
          'verification.verdict',
          'verification.date',
          'verification.rationale',
          'verification.reportUrl',
        ],
      },
    ])
  })

  it('stops reviewers setting a verdict while it is enabled, and leaves them be when not', () => {
    const verdictField = (enabled: boolean) => {
      const config = applyManifest(
        { collections: [Claims] } as unknown as Config,
        checkPlugin.manifest,
        enabled,
      )
      const claims = config.collections?.find((c) => c.slug === 'claims')
      const inside = (fields: readonly Field[]): Field[] =>
        fields.flatMap((f) => ('name' in f ? [f] : 'fields' in f ? inside(f.fields) : []))
      const group = claims?.fields.find((f) => 'name' in f && f.name === 'verification')
      const fields = group && 'fields' in group ? inside(group.fields) : []
      const verdict = fields.find((f) => 'name' in f && f.name === 'verdict') as
        | { access?: { update?: (args: never) => boolean } }
        | undefined
      return verdict?.access?.update
    }
    const reviewer = { req: { user: { id: 'r', roles: ['reviewer'] } } } as never
    const superAdmin = { req: { user: { id: 's', roles: ['super-admin'] } } } as never
    expect(verdictField(true)?.(reviewer)).toBe(false)
    expect(verdictField(true)?.(superAdmin)).toBe(true)
    expect(verdictField(false)?.(reviewer)).toBe(true)
  })

  it('sends a claim as a Check item with the field mapping in section 5.2', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    const sent = await adapter.submit(claim, ctx())

    expect(sent).toEqual({
      externalId: itemId(12345),
      url: 'https://checkmedia.org/promise-tracker/media/12345',
    })
    const [request] = api.sent
    expect(request?.headers.get('X-Check-Team')).toBe('promise-tracker')
    expect(request?.headers.get('X-Check-Token')).toBe('test-api-key')
    expect(request?.variables.input).toEqual({
      media_type: 'Claim',
      quote: claim.statement,
      channel: { main: 1 },
      set_tags: ['health', 'promise', 'ke'],
      set_claim_description: `${claim.title}: ${claim.summary}\n\n${claim.url}`,
    })
  })

  it('links back to the claim in the description, with or without a summary', () => {
    const { summary: _summary, ...bare } = claim
    expect(claimDescription(bare)).toBe(`${claim.title}\n\n${claim.url}`)
  })

  it('waits for Retry-After on a 429, then retries', async () => {
    let calls = 0
    const waits: number[] = []
    const api = recordedCheck({
      createProjectMedia: () => {
        calls++
        return calls === 1
          ? new Response('Too many requests', { status: 429, headers: { 'Retry-After': '7' } })
          : recording('createProjectMedia')
      },
    })
    const created = await createItem(
      settings,
      { quote: 'q', description: 'd', tags: [] },
      { ...api, sleep: async (ms) => void waits.push(ms) },
    )
    expect(created.id).toBe(itemId(12345))
    expect(waits).toEqual([7_000])
  })

  it('stops calling Check after repeated outages, and reports it in health', async () => {
    const api = recordedCheck({
      createProjectMedia: () => new Response('down', { status: 503 }),
    })
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    for (let i = 0; i < 2; i++) {
      await expect(adapter.submit(claim, ctx())).rejects.toBeInstanceOf(ExternalServiceError)
    }
    expect(await adapter.health(ctx())).toEqual({
      healthy: false,
      detail: 'Calls to Check are paused after repeated failures.',
    })
  })

  it('reports itself unhealthy until the workspace and key are set', async () => {
    expect((await createCheckVerification().health(ctx({}))).healthy).toBe(false)
    expect((await createCheckVerification().health(ctx())).healthy).toBe(true)
  })

  it('polls published and paused reports, 100 to a page, and maps each status to a verdict', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    const { updates, position } = await adapter.pull(null, ctx())

    const pages = api.sent.map((r) => JSON.parse(String(r.variables.query)))
    expect(pages).toEqual([
      {
        report_status: ['published'],
        sort: 'recent_activity',
        sort_type: 'desc',
        eslimit: 100,
        esoffset: 0,
      },
      {
        report_status: ['published'],
        sort: 'recent_activity',
        sort_type: 'desc',
        eslimit: 100,
        esoffset: 100,
      },
      {
        report_status: ['paused'],
        sort: 'recent_activity',
        sort_type: 'desc',
        eslimit: 100,
        esoffset: 0,
      },
    ])
    expect(position).toBeNull()
    expect(updates).toHaveLength(104)
    // A pause whose webhook was lost is withdrawn by the poll.
    expect(updates.find((u) => u.externalId === itemId(30000))).toEqual({
      externalId: itemId(30000),
      verdict: 'unverified',
      withdrawn: true,
    })
    expect(updates.find((u) => u.externalId === itemId(12345))).toEqual({
      externalId: itemId(12345),
      verdict: 'verified',
      rationale: 'Report for item 12345.',
      verifiedAt: '2025-11-25T10:00:00.000Z',
      reportUrl: 'https://example.org/fact-checks/12345',
    })
    expect(updates.find((u) => u.externalId === itemId(20001))?.verdict).toBe('false')
    expect(updates.find((u) => u.externalId === itemId(20100))?.verdict).toBe('unverified')
  })

  it('reads as deep as Check\u2019s search allows, 10,000 results, and no further', async () => {
    const full = recording('search-page-1')
    const api = recordedCheck({ publishedReports: () => full })
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    await adapter.pull(null, ctx())
    const offsets = api.sent
      .map((r) => JSON.parse(String(r.variables.query)))
      .filter((q) => q.report_status[0] === 'published')
      .map((q) => q.esoffset)
    expect(offsets).toHaveLength(100)
    expect(offsets.at(-1)).toBe(9_900)
  })

  it('applies a published report from the webhook, reading the status from Check', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    const updates = await adapter.receive?.(recording('webhook-published'), new Headers(), ctx())

    expect(api.sent.map((r) => [r.operation, r.variables])).toEqual([
      ['ProjectMedia', { ids: '12345' }],
    ])
    expect(updates).toEqual([
      {
        externalId: itemId(12345),
        verdict: 'verified',
        rationale: "The ministry's budget statement lists the 200 centres as built.",
        verifiedAt: '2025-11-25T10:00:00.000Z',
        reportUrl: 'https://example.org/fact-checks/health-centres',
      },
    ])
  })

  it('withdraws the verdict when a report is paused, without calling Check', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    const updates = await adapter.receive?.(recording('webhook-paused'), new Headers(), ctx())
    expect(api.sent).toEqual([])
    expect(updates).toEqual([{ externalId: itemId(12345), verdict: 'unverified', withdrawn: true }])
  })

  it('ignores events other than report_design', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    expect(await adapter.receive?.(recording('webhook-other'), new Headers(), ctx())).toEqual([])
    expect(api.sent).toEqual([])
  })

  it('applies nothing for a published report whose status has no verdict', async () => {
    const api = recordedCheck()
    const adapter = createCheckVerification({ ...api, sleep: noWait })
    const unmapped = { ...settings, statuses: [{ status: 'false', verdict: 'false' }] }
    const updates = await adapter.receive?.(
      recording('webhook-published'),
      new Headers(),
      ctx(unmapped),
    )
    expect(updates).toEqual([])
    expect(logger.error).toHaveBeenCalled()
  })
})

describe('the status mapping at start-up', () => {
  it('passes when every workspace status has a verdict', async () => {
    const api = recordedCheck()
    await expect(checkStatusMapping(ctx(), api)).resolves.toBeUndefined()
    expect(api.sent[0]?.operation).toBe('TeamStatuses')
  })

  it('stops start-up and names an unmapped status', async () => {
    const api = recordedCheck()
    const partial = {
      ...settings,
      statuses: settings.statuses.filter((s) => s.status !== 'in_progress'),
    }
    const check = checkStatusMapping(ctx(partial), api)
    await expect(check).rejects.toBeInstanceOf(ConfigurationError)
    await expect(checkStatusMapping(ctx(partial), api)).rejects.toThrow(
      '"In Progress" (in_progress)',
    )
  })

  it('only warns when the settings are not filled in yet', async () => {
    const api = recordedCheck()
    await expect(checkStatusMapping(ctx({}), api)).resolves.toBeUndefined()
    expect(api.sent).toEqual([])
    expect(logger.warn).toHaveBeenCalled()
  })

  it('only warns when Check cannot be reached, so a deploy is not stopped', async () => {
    const api = recordedCheck({ teamStatuses: () => new Response('down', { status: 503 }) })
    await expect(checkStatusMapping(ctx(), { ...api, sleep: noWait })).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('reading Check data', () => {
  it('reads a report given as a JSON string or as an object', () => {
    const data = { state: 'published', options: { text: 'Why.' } }
    expect(readReport(JSON.stringify(data))?.text).toBe('Why.')
    expect(readReport(data)?.state).toBe('published')
    expect(readReport('not json')).toBeNull()
  })

  it('reads times as seconds since 1970 or as dates', () => {
    expect(toIso('1764064800')).toBe('2025-11-25T10:00:00.000Z')
    expect(toIso(1764064800)).toBe('2025-11-25T10:00:00.000Z')
    expect(toIso('2026-01-02T03:04:05Z')).toBe('2026-01-02T03:04:05.000Z')
    expect(toIso('never')).toBeNull()
  })

  it('names an item as base64 of ProjectMedia/{number}', () => {
    expect(itemId(12345)).toBe('UHJvamVjdE1lZGlhLzEyMzQ1')
  })
})

describe('the webhook secret', () => {
  it('matches the secret as sent, or after Bearer', () => {
    expect(secretMatches('test-webhook-secret', 'test-webhook-secret')).toBe(true)
    expect(secretMatches('Bearer test-webhook-secret', 'test-webhook-secret')).toBe(true)
    expect(secretMatches('wrong', 'test-webhook-secret')).toBe(false)
    expect(secretMatches(null, 'test-webhook-secret')).toBe(false)
  })
})

describe('the webhook', () => {
  const post = (body: unknown, authorization = 'test-webhook-secret') =>
    new Request('https://pt.test/api/plugins/check/webhook', {
      method: 'POST',
      headers: { Authorization: authorization },
      body: JSON.stringify(body),
    })
  const deps = (receive: () => Promise<never[]>, own: Record<string, unknown> = settings) => ({
    payload: {} as Payload,
    adapter: { ...createCheckVerification(), receive },
    context: async () => ctx(own),
  })

  beforeEach(() => forgetDeliveries())

  it('answers 401 with no secret set, as for a wrong one, and logs why', async () => {
    const { webhookSecret: _unset, ...unset } = settings
    const response = await handleWebhook(
      post({}),
      deps(async () => [], unset),
    )
    expect(response.status).toBe(401)
    expect(logger.error).toHaveBeenCalled()
  })

  it('processes a delivery again when Check retries one that failed', async () => {
    let calls = 0
    const receive = async (): Promise<never[]> => {
      calls++
      if (calls === 1) throw new Error('database down')
      return []
    }
    const body = recording('webhook-published')
    const first = await handleWebhook(post(body), deps(receive))
    expect(first.status).toBe(500)
    const retry = await handleWebhook(post(body), deps(receive))
    expect(retry.status).toBe(200)
    expect(await retry.json()).not.toHaveProperty('repeated')
    expect(calls).toBe(2)
  })
})
