import { getPayload } from '@promisetracker/cms'
import type { AdapterContext } from '@promisetracker/kernel'
import {
  createCheckVerification,
  DEFAULT_STATUS_MAP,
  forgetDeliveries,
  handleWebhook,
  itemId,
  pollCheck,
} from '@promisetracker/plugin-check'
import type { CountryCode } from '@promisetracker/plugin-core'
import { nativeVerification, setTagRefresher, setVerification } from '@promisetracker/plugin-core'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { recordedCheck, recording } from '../check-api'
import { unusedCountryCodes } from '../countries'

const SECRET = 'test-webhook-secret'
const settings = {
  workspace: 'promise-tracker',
  apiKey: 'test-api-key',
  webhookSecret: SECRET,
  statuses: DEFAULT_STATUS_MAP.map((row) => ({ ...row })),
}

/**
 * plugin-check against a recorded Check API (section 5.2): a claim goes out
 * when created, and its verdict comes back by webhook and by the poll.
 */
describe('verification in Check', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let actor: string
  let topic: string
  let editor: { id: string }
  let claimId = ''
  const api = recordedCheck()
  const adapter = createCheckVerification({ ...api, sleep: async () => {} })
  const context = async (): Promise<AdapterContext> => ({
    payload,
    logger: payload.logger,
    signal: new AbortController().signal,
    settings,
  })
  const deps = () => ({ payload, adapter, context })

  const post = (body: unknown, secret: string | null = SECRET) =>
    handleWebhook(
      new Request('https://pt.test/api/plugins/check/webhook', {
        method: 'POST',
        headers: secret ? { Authorization: secret } : {},
        body: JSON.stringify(body),
      }),
      deps(),
    )
  const read = async () =>
    (await payload.findByID({
      collection: 'claims',
      id: claimId,
      depth: 0,
      locale: 'en',
      overrideAccess: true,
    })) as unknown as {
      recordStatus: string
      verification?: Record<string, unknown>
      check?: Record<string, unknown>
    }

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async () => {})
    setVerification({ adapter, context: () => context() })
    ;[code = 'km'] = await unusedCountryCodes(payload, 1)
    // Test set-up writes as the system.
    country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    actor = (
      await payload.create({
        collection: 'actors',
        data: { name: 'Check Test Governor', kind: 'person', country, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    topic = (
      await payload.create({
        collection: 'topics',
        locale: 'en',
        data: { name: 'Check test topic' },
        overrideAccess: true,
      })
    ).id
    editor = await payload.create({
      collection: 'users',
      data: {
        email: `editor-check-${code}@example.org`,
        password: 'a-test-password-only',
        name: 'Check test editor',
        roles: ['editor'],
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    setVerification({
      adapter: nativeVerification,
      context: async (p) => ({ ...(await context()), payload: p, settings: {} }),
    })
    for (const collection of ['claims', 'actors'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
        trash: true,
      })
    }
    await payload.delete({ collection: 'topics', id: topic, overrideAccess: true })
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    await payload.delete({ collection: 'users', id: editor.id, overrideAccess: true })
  })

  it('sends a new claim to Check and stores the item id and link', async () => {
    const doc = await payload.create({
      collection: 'claims',
      locale: 'en',
      data: {
        title: 'Build 200 new health centres',
        statement: 'We will build 200 new health centres by 2027',
        slug: 'build-200-health-centres',
        actor,
        topic,
        sourceUrl: 'https://example.org/manifesto',
        recordStatus: 'ready',
      } as never,
      overrideAccess: true,
    })
    claimId = doc.id
    const { docs: jobs } = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'submitForVerification' } },
      sort: '-createdAt',
      limit: 20,
      overrideAccess: true,
    })
    const job = jobs.find((j) => (j.input as { claim?: string } | null)?.claim === claimId)
    expect(job).toBeDefined()
    if (!job) return
    await payload.jobs.runByID({ id: job.id, overrideAccess: true })

    const stored = await read()
    expect(stored.check?.itemId).toBe(itemId(12345))
    expect(stored.check?.itemUrl).toBe('https://checkmedia.org/promise-tracker/media/12345')
    expect(stored.check?.syncedAt).toBeTruthy()
    const sent = api.sent.find((r) => r.operation === 'createProjectMedia')
    expect(sent?.variables.input).toMatchObject({
      quote: 'We will build 200 new health centres by 2027',
      set_status: 'undetermined',
      set_tags: expect.arrayContaining([code]),
    })
  })

  it('answers 401 to a wrong secret without reading the body', async () => {
    const request = new Request('https://pt.test/api/plugins/check/webhook', {
      method: 'POST',
      headers: { Authorization: 'wrong' },
      body: JSON.stringify(recording('webhook-published')),
    })
    const response = await handleWebhook(request, deps())
    expect(response.status).toBe(401)
    expect(request.bodyUsed).toBe(false)
  })

  it('acknowledges events other than reports and does nothing', async () => {
    const response = await post(recording('webhook-other'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ignored: true })
  })

  it('applies a published report: verdict, rationale, date and report link', async () => {
    forgetDeliveries()
    const response = await post(recording('webhook-published'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ applied: 1, unknown: 0 })

    const stored = await read()
    expect(stored.verification).toMatchObject({
      verdict: 'verified',
      rationale: "The ministry's budget statement lists the 200 centres as built.",
      reportUrl: 'https://example.org/fact-checks/health-centres',
      verifiedBy: null,
    })
    expect(new Date(String(stored.verification?.date)).toISOString()).toBe(
      '2025-11-25T10:00:00.000Z',
    )
    expect(stored.check).toMatchObject({ reportState: 'published', syncResult: 'applied' })
  })

  it('gives a repeated delivery the first answer, without acting again', async () => {
    const before = api.sent.length
    const response = await post(recording('webhook-published'))
    expect(await response.json()).toMatchObject({ applied: 1, repeated: true })
    expect(api.sent.length).toBe(before)
  })

  it('answers 200 to a report for an item it does not know, leaving it for the poll', async () => {
    const unknown = recordedCheck({
      projectMedia: () => {
        const body = recording('project_media') as {
          data: { project_media: Record<string, unknown> }
        }
        return { data: { project_media: { ...body.data.project_media, id: itemId(99999) } } }
      },
    })
    const other = createCheckVerification({ ...unknown, sleep: async () => {} })
    const body = recording('webhook-published') as { object: Record<string, unknown> }
    const response = await handleWebhook(
      new Request('https://pt.test/api/plugins/check/webhook', {
        method: 'POST',
        headers: { Authorization: `Bearer ${SECRET}` },
        body: JSON.stringify({ ...body, object: { ...body.object, annotated_id: 99999 } }),
      }),
      { payload, adapter: other, context },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ applied: 0, unknown: 1 })
  })

  it('keeps the verdict from Check when an editor saves the claim', async () => {
    await payload.update({
      collection: 'claims',
      id: claimId,
      locale: 'en',
      data: { title: 'Build 200 new health centres by 2027', verification: { verdict: 'false' } },
      overrideAccess: false,
      user: { ...editor, collection: 'users' } as never,
    })
    const stored = await read()
    expect(stored.verification?.verdict).toBe('verified')
    expect(stored.check?.itemId).toBe(itemId(12345))
  })

  it('withdraws the verdict when the report is paused, holds the claim and tells editors', async () => {
    const sendEmail = vi.spyOn(payload, 'sendEmail').mockResolvedValue(undefined as never)
    const response = await post(recording('webhook-paused'))
    expect(response.status).toBe(200)

    const stored = await read()
    expect(stored.verification?.verdict).toBe('unverified')
    expect(stored.recordStatus).toBe('hold')
    expect(stored.check).toMatchObject({ reportState: 'paused' })
    const subjects = sendEmail.mock.calls.map(([message]) => String(message.subject))
    expect(subjects).toContain('Verdict withdrawn: Build 200 new health centres by 2027')
    sendEmail.mockRestore()
  })

  it('reconciles published reports in the poll, catching a lost webhook', async () => {
    const result = await pollCheck(deps())
    // Only item 12345 is a claim here. The rest of the recorded reports are unknown.
    expect(result.applied).toBe(1)
    const stored = await read()
    expect(stored.verification).toMatchObject({
      verdict: 'verified',
      rationale: 'Report for item 12345.',
    })
    // A second poll finds nothing new.
    expect((await pollCheck(deps())).applied).toBe(0)
  })
})
