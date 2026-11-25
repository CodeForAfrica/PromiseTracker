import { getPayload, handleForm, inputOf, respondForm, respondV1 } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import {
  confirmSignup,
  deleteOldSubmissions,
  localNewsletter,
  NEWSLETTER_SIGNUPS,
  SUBMISSIONS,
  sendSubmissionsDigest,
  solveChallenge,
} from '@promisetracker/plugin-core'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { unusedCountryCodes } from '../countries'

// Mailpit's API, from `pnpm services` or the CI service.
const mailpit = `http://localhost:${process.env.PT_MAIL_UI_PORT || '8025'}/api/v1`

async function mailTo(address: string): Promise<{ ID: string; Subject: string } | undefined> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${mailpit}/search?query=${encodeURIComponent(`to:"${address}"`)}`)
    const { messages } = (await res.json()) as { messages: { ID: string; Subject: string }[] }
    if (messages[0]) return messages[0]
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return undefined
}

const mailText = async (id: string) =>
  ((await (await fetch(`${mailpit}/message/${id}`)).json()) as { Text: string }).Text

/**
 * Citizen submissions and newsletter sign-ups (sections 7.9, 12.1 and 13.9),
 * on a claim in a small country no one tracks.
 */
describe('submissions and sign-ups', () => {
  let payload: Payload
  let code: CountryCode
  let claim: string
  let moderator: { id: string; email: string; roles?: unknown }
  let address = 0
  const as = (user: { id: string }) => ({ ...user, collection: 'users' }) as never

  /** A new address each time, so the rate limit never trips by accident. */
  const sender = () => ({ ip: `203.0.113.${++address}` })

  /** A solved captcha, as a browser would send it. */
  const solved = async () => {
    const res = await respondV1(
      new Request('http://promisetracker.test/api/v1/captcha?locale=en'),
      '/captcha',
      getPayload,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { data } = (await res.json()) as { data: { challenge: string } }
    return solveChallenge(data.challenge)
  }

  const submit = async (fields: Record<string, unknown>, from = sender()) =>
    handleForm(
      payload,
      '/submissions',
      inputOf({
        locale: 'en',
        country: code,
        claim: 'a-road-to-the-market',
        kind: 'evidence',
        text: 'The road is half built.',
        captcha: await solved(),
        ...fields,
      }),
      from,
    )

  const referenceOf = (result: { body: unknown } | undefined) =>
    String((result?.body as { reference?: string } | undefined)?.reference ?? '')

  const stored = async (reference: string) => {
    const { docs } = await payload.find({
      collection: SUBMISSIONS,
      sort: '-createdAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const suffix = reference.split('-')[1]?.toLowerCase() ?? ''
    const doc = docs.find((d) => d.id.replace(/-/g, '').startsWith(suffix))
    if (!doc) throw new Error(`No submission ${reference}`)
    return doc
  }

  beforeAll(async () => {
    payload = await getPayload()
    ;[code = 'km'] = await unusedCountryCodes(payload, 1)
    // Test set-up writes as the system.
    const country = (
      await payload.create({
        collection: 'countries',
        locale: 'en',
        data: { code, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    const office = await payload.create({
      collection: 'offices',
      locale: 'en',
      data: { name: 'Governor', areaType: 'country', holdersPerSeat: 1, order: 1, country },
      overrideAccess: true,
    })
    const actor = await payload.create({
      collection: 'actors',
      data: { name: 'Neema Atieno', kind: 'person', country, recordStatus: 'ready' },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'terms',
      data: { actor: actor.id, office: office.id, startsOn: '2022-09-13T12:00:00.000Z' },
      overrideAccess: true,
    })
    const topic = await payload.create({
      collection: 'topics',
      locale: 'en',
      data: { name: `Submissions test topic ${code}` },
      overrideAccess: true,
    })
    claim = (
      await payload.create({
        collection: 'claims',
        locale: 'en',
        data: {
          title: 'A road to the market',
          slug: 'a-road-to-the-market',
          actor: actor.id,
          topic: topic.id,
          deadline: '2027',
          sourceUrl: 'https://example.org/manifesto',
          recordStatus: 'ready',
          verification: { verdict: 'verified' },
        } as never,
        overrideAccess: true,
      })
    ).id
    const created = await payload.create({
      collection: 'users',
      data: {
        email: `moderator-${code}@example.org`,
        password: 'a-test-password-only',
        name: 'Submissions test moderator',
        roles: ['moderator'],
      },
      overrideAccess: true,
    })
    moderator = created
  })

  afterAll(async () => {
    await payload.destroy()
  })

  it('stores a submission with a solved captcha, and answers with a reference', async () => {
    const result = await submit({
      kind: 'changed',
      location: 'Kisumu',
      link: 'https://example.org/photo',
      contact: '+254 700 000000',
    })
    expect(result?.status).toBe(201)
    const { reference } = (result?.body ?? {}) as { reference: string }
    expect(reference).toMatch(new RegExp(`^${code.toUpperCase()}-[0-9A-F]{8}$`))
    const doc = await stored(reference)
    expect(doc).toMatchObject({
      claim,
      kind: 'changed',
      status: 'new',
      location: 'Kisumu',
      locale: 'en',
    })
    // A scrambled address, never the address itself.
    expect(doc.sender).toMatch(/^[\w-]{22}$/)
    expect(JSON.stringify(doc)).not.toContain('203.0.113.')
  })

  it('refuses a form without a solved captcha, or with the trap field filled', async () => {
    expect((await submit({ captcha: 'v1.0.16.salt.sig.1' }))?.status).toBe(403)
    expect((await submit({ website: 'https://spam.example' }))?.status).toBe(403)
  })

  it('accepts a solved challenge only once', async () => {
    const captcha = await solved()
    expect((await submit({ captcha }))?.status).toBe(201)
    expect((await submit({ captcha }))?.status).toBe(403)
  })

  it('rate limits by the scrambled network address', async () => {
    const from = { ip: '198.51.100.7' }
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await submit({}, from))?.status ?? 0)
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true)
    expect(statuses[10]).toBe(403)
    // Another address is not held back.
    expect((await submit({}))?.status).toBe(201)
  })

  it('refuses a missing text, an unknown kind or a claim not on the public site', async () => {
    expect((await submit({ text: '' }))?.status).toBe(400)
    expect((await submit({ kind: 'praise' }))?.status).toBe(400)
    expect((await submit({ claim: 'no-such-claim' }))?.status).toBe(404)
  })

  it('takes photos whose bytes match their type, over HTTP', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
    const form = new FormData()
    for (const [key, value] of Object.entries({
      locale: 'en',
      country: code,
      claim: 'a-road-to-the-market',
      kind: 'evidence',
      text: 'A photo of the site.',
      captcha: await solved(),
      website: '',
    })) {
      form.set(key, value)
    }
    form.append('files', new File([png], 'site.png', { type: 'image/png' }))
    const post = (body: FormData) =>
      respondForm(
        new Request('http://promisetracker.test/api/v1/submissions', {
          method: 'POST',
          body,
          headers: { 'x-forwarded-for': '192.0.2.40' },
        }),
        '/submissions',
        getPayload,
      )
    const res = await post(form)
    expect(res.status).toBe(201)
    const doc = await stored(((await res.json()) as { reference: string }).reference)
    expect(doc.files).toHaveLength(1)

    // A file whose bytes are not what its name says is refused.
    form.set('captcha', await solved())
    form.delete('files')
    form.append('files', new File(['not a photo'], 'site.png', { type: 'image/png' }))
    expect((await post(form)).status).toBe(400)
  })

  it('is readable by moderators only, and never by a guest', async () => {
    await expect(payload.find({ collection: SUBMISSIONS, overrideAccess: false })).rejects.toThrow(
      'not allowed',
    )
    const staff = await payload.find({
      collection: SUBMISSIONS,
      overrideAccess: false,
      user: as(moderator),
    })
    expect(staff.totalDocs).toBeGreaterThan(0)
  })

  it('accepting makes a draft claim update, credited only with consent', async () => {
    const accept = async (fields: Record<string, unknown>) => {
      const result = await submit(fields)
      const doc = await stored(referenceOf(result))
      const accepted = await payload.update({
        collection: SUBMISSIONS,
        id: doc.id,
        data: { status: 'accepted' },
        overrideAccess: false,
        user: as(moderator),
      })
      expect(accepted.moderator).toMatchObject({ id: moderator.id })
      const updateId =
        typeof accepted.claimUpdate === 'string' ? accepted.claimUpdate : accepted.claimUpdate?.id
      if (!updateId) throw new Error('No claim update was made.')
      return payload.findByID({
        collection: 'claim-updates',
        id: updateId,
        draft: true,
        depth: 0,
        overrideAccess: true,
      })
    }
    const credited = await accept({ name: 'Achieng', consent: 'true', text: 'Paving is done.' })
    expect(credited).toMatchObject({
      claim,
      _status: 'draft',
      attribution: 'Achieng',
      narrative: 'Paving is done.',
    })
    const anonymous = await accept({ name: 'Otieno', text: 'Work has stopped.' })
    expect(anonymous.attribution ?? null).toBeNull()
  })

  it('lets a moderator delete the sender’s contact details', async () => {
    const result = await submit({ name: 'Wambui', contact: 'wambui@example.org' })
    const doc = await stored(referenceOf(result))
    const cleared = await payload.update({
      collection: SUBMISSIONS,
      id: doc.id,
      data: { name: null, contact: null },
      overrideAccess: false,
      user: as(moderator),
    })
    expect(cleared.name ?? null).toBeNull()
    expect(cleared.contact ?? null).toBeNull()
  })

  it('sends moderators a daily digest of new submissions', async () => {
    expect(await sendSubmissionsDigest(payload)).toBe(true)
    const message = await mailTo(moderator.email)
    expect(message?.Subject).toMatch(/new submissions? to moderate$/)
    // Nothing new in the window, nothing sent.
    expect(await sendSubmissionsDigest(payload, new Date(Date.now() + 2 * 86_400_000))).toBe(false)
  })

  it('deletes rejected and spam submissions after 180 days', async () => {
    const result = await submit({})
    const doc = await stored(referenceOf(result))
    await payload.update({
      collection: SUBMISSIONS,
      id: doc.id,
      data: { status: 'spam' },
      overrideAccess: true,
    })
    const later = new Date(Date.now() + 181 * 86_400_000)
    expect(await deleteOldSubmissions(payload, later)).toBeGreaterThan(0)
    const left = await payload.find({
      collection: SUBMISSIONS,
      where: { id: { equals: doc.id } },
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)
  })

  it('stores a sign-up unconfirmed and emails a link that confirms it', async () => {
    const email = `reader-${code}-${Date.now()}@example.org`
    const send = vi.spyOn(payload, 'sendEmail')
    const result = await handleForm(
      payload,
      '/subscriptions',
      inputOf({ locale: 'fr', email, captcha: await solved() }),
      sender(),
    )
    expect(result?.status).toBe(201)
    expect(send).toHaveBeenCalledOnce()
    send.mockRestore()
    const find = async () =>
      (
        await payload.find({
          collection: NEWSLETTER_SIGNUPS,
          where: { email: { equals: email } },
          overrideAccess: true,
        })
      ).docs[0]
    expect(await find()).toMatchObject({ email, locale: 'fr', confirmed: false })

    const message = await mailTo(email)
    expect(message?.Subject).toBe('Confirm your PromiseTracker newsletter sign-up')
    const link = (await mailText(message?.ID ?? '')).match(/\/fr\/newsletter\/confirm\?token=(\S+)/)
    const token = link?.[1] ?? ''
    expect(token).not.toBe('')
    expect(await confirmSignup(payload, token)).toBe(true)
    expect(await find()).toMatchObject({ confirmed: true })
    // A link works once.
    expect(await confirmSignup(payload, token)).toBe(false)
  })

  it('sends nothing to an address already confirmed', async () => {
    const email = `confirmed-${code}-${Date.now()}@example.org`
    await payload.create({
      collection: NEWSLETTER_SIGNUPS,
      data: { email, locale: 'en', confirmed: true },
      overrideAccess: true,
    })
    const send = vi.spyOn(payload, 'sendEmail')
    const ctx = {
      payload,
      logger: payload.logger,
      signal: new AbortController().signal,
      settings: {},
    }
    await localNewsletter.subscribe(email, 'en', ctx as never)
    expect(send).not.toHaveBeenCalled()
    send.mockRestore()
  })

  it('refuses a sign-up with an invalid address or no captcha', async () => {
    const form = (fields: Record<string, unknown>) =>
      handleForm(payload, '/subscriptions', inputOf({ locale: 'en', ...fields }), sender())
    expect((await form({ email: 'not-an-email', captcha: await solved() }))?.status).toBe(400)
    expect((await form({ email: 'someone@example.org' }))?.status).toBe(403)
  })
})
