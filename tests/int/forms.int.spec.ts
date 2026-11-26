import { getPayload, handleV1, respondV1, respondV1Post } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import {
  newChallenge,
  setTagRefresher,
  solve,
  submissionCounts,
  submissionDigest,
} from '@promisetracker/plugin-core'
import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * The public forms against the database (sections 7.9, 12, 13.5 and 13.9):
 * a submission from the form to a held claim update, the trap field, the
 * captcha and the rate limit, the daily digest, and a newsletter sign-up
 * from the form to its confirmation.
 */
describe('the public forms', () => {
  let payload: Payload
  let code: CountryCode
  let held: string
  const word = crypto.randomUUID().slice(0, 8)
  const made: { collection: CollectionSlug; id: string }[] = []
  let sender = 0

  const create = async (collection: CollectionSlug, data: Record<string, unknown>) => {
    const doc = await payload.create({
      collection,
      data: data as never,
      locale: 'en',
      overrideAccess: true,
    })
    made.unshift({ collection, id: String(doc.id) })
    return String(doc.id)
  }

  const answer = () => {
    const { challenge } = newChallenge(payload.secret)
    return `${challenge}:${solve(challenge)}`
  }

  /** A sender of their own, so one test's rate limit never reaches another. */
  const from = () => {
    sender += 1
    return { 'x-forwarded-for': `198.51.100.${sender}` }
  }

  const submit = (fields: Record<string, string>, files: File[] = [], headers = from()) => {
    const body = new FormData()
    const all = {
      locale: 'en',
      country: code,
      claim: `pipe-${word}-water`,
      kind: 'evidence',
      text: 'The site is still fenced.',
      captcha: answer(),
      ...fields,
    }
    for (const [key, value] of Object.entries(all)) body.set(key, value)
    for (const file of files) body.append('files', file)
    return respondV1Post(
      new Request('http://localhost/api/v1/submissions', { method: 'POST', body, headers }),
      '/submissions',
      getPayload,
    )
  }

  const subscribe = (fields: Record<string, string>, headers = from()) =>
    respondV1Post(
      new Request('http://localhost/api/v1/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ locale: 'en', captcha: answer(), ...fields }),
        headers: { 'content-type': 'application/json', ...headers },
      }),
      '/subscriptions',
      getPayload,
    )

  const latest = async (where: Record<string, unknown> = {}) =>
    (
      await payload.find({
        collection: 'submissions',
        where: where as never,
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]

  beforeAll(async () => {
    payload = await getPayload()
    setTagRefresher(async () => {})
    ;[code = 'cv'] = (await unusedCountryCodes(payload, 1)) as CountryCode[]
    const country = await create('countries', { code, recordStatus: 'ready' })
    const actor = await create('actors', {
      name: `Ilvanne ${word}`,
      kind: 'person',
      country,
      recordStatus: 'ready',
    })
    const office = await create('offices', {
      name: 'President',
      areaType: 'country',
      holdersPerSeat: 1,
      order: 1,
      country,
    })
    await create('terms', { actor, office, startsOn: '2022-09-13T12:00:00.000Z' })
    const topic = await create('topics', { name: `${word} water` })
    const ready = {
      actor,
      topic,
      sourceUrl: 'https://example.org/manifesto',
      recordStatus: 'ready',
      verification: { verdict: 'verified' },
    }
    await create('claims', { title: `Pipe ${word} water`, ...ready })
    held = await create('claims', { title: `Pave ${word} roads`, ...ready, recordStatus: 'hold' })
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'submissions',
      where: { 'claim.country.code': { equals: code } } as never,
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'claim-updates',
      where: { 'claim.country.code': { equals: code } } as never,
      overrideAccess: true,
      trash: true,
    })
    for (const { collection, id } of made) {
      await payload.delete({ collection, id, overrideAccess: true, trash: true }).catch(() => {})
    }
  })

  describe('a submission (section 7.9)', () => {
    it('is stored with a reference, the scrambled sender and nothing public', async () => {
      const res = await submit({ location: 'Kibra', name: 'Amina', contact: 'amina@example.org' })
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      const { reference, sent } = (await res.json()) as { reference: string; sent: string }
      expect(reference).toMatch(new RegExp(`^${code.toUpperCase()}-\\d{4}-\\d{5}$`))
      expect(sent).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const stored = await latest({ reference: { equals: reference } })
      expect(stored).toMatchObject({
        kind: 'evidence',
        status: 'new',
        location: 'Kibra',
        name: 'Amina',
        consent: false,
        language: 'en',
      })
      expect(stored?.addressHash).toMatch(/^[0-9a-f]{16}$/)
      // Nobody outside the staff reads submissions or their senders.
      await expect(
        payload.find({ collection: 'submissions', overrideAccess: false }),
      ).rejects.toThrow()
    })

    it('keeps a photo, and refuses a file that is not what it says', async () => {
      // The smallest valid PNG.
      const png = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ),
        (c) => c.charCodeAt(0),
      )
      const ok = await submit({}, [new File([png], 'site.png', { type: 'image/png' })])
      expect(ok.status).toBe(200)
      const { reference } = (await ok.json()) as { reference: string }
      expect((await latest({ reference: { equals: reference } }))?.files).toHaveLength(1)

      const fake = new File(['<script>alert(1)</script>'], 'site.png', { type: 'image/png' })
      const refused = await submit({}, [fake])
      expect(refused.status).toBe(400)
    })

    it('tells a bot that fills the trap field all went well, and keeps nothing', async () => {
      const before = await payload.count({ collection: 'submissions', overrideAccess: true })
      const res = await submit({ website: 'https://spam.example' })
      expect(res.status).toBe(200)
      const after = await payload.count({ collection: 'submissions', overrideAccess: true })
      expect(after.totalDocs).toBe(before.totalDocs)
    })

    it('refuses a missing, wrong or spent captcha answer', async () => {
      expect((await submit({ captcha: 'nonsense' })).status).toBe(403)
      const spent = answer()
      expect((await submit({ captcha: spent })).status).toBe(200)
      expect((await submit({ captcha: spent })).status).toBe(403)
    })

    it('refuses a claim that is not published, and a form of the wrong shape', async () => {
      expect((await submit({ claim: `pave-${word}-roads` })).status).toBe(404)
      expect((await submit({ kind: 'praise' })).status).toBe(400)
      expect((await submit({ text: '' })).status).toBe(400)
      expect((await submit({ evidenceUrl: 'javascript:alert(1)' })).status).toBe(400)
    })

    it('limits how many one sender may send', async () => {
      const headers = from()
      const statuses = []
      for (let i = 0; i < 6; i++) statuses.push((await submit({}, [], headers)).status)
      expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    })
  })

  describe('moderation (section 13.2)', () => {
    const moderator = async () => {
      const id = await create('users', {
        email: `moderator-${crypto.randomUUID()}@example.org`,
        password: `pw-${crypto.randomUUID()}`,
        name: 'Moderator',
        roles: ['moderator'],
      })
      return {
        ...(await payload.findByID({ collection: 'users', id, overrideAccess: true })),
        collection: 'users',
      } as NonNullable<PayloadRequest['user']>
    }

    it('turns an accepted submission into a held claim update, crediting the sender only with consent', async () => {
      const user = await moderator()
      for (const [consent, attribution] of [
        ['true', 'Amina Wanjiru'],
        ['false', null],
      ] as const) {
        const res = await submit({ name: 'Amina Wanjiru', consent, text: 'The pipes are laid.' })
        const { reference } = (await res.json()) as { reference: string }
        const found = await latest({ reference: { equals: reference } })
        if (!found) throw new Error('No submission')
        const saved = await payload.update({
          collection: 'submissions',
          id: found.id,
          data: { status: 'accepted' },
          user,
          overrideAccess: false,
        })
        expect(saved.moderator).toBeTruthy()
        const updateId = typeof saved.update === 'object' ? saved.update?.id : saved.update
        const update = await payload.findByID({
          collection: 'claim-updates',
          id: String(updateId),
          depth: 0,
          overrideAccess: true,
        })
        expect(update).toMatchObject({
          recordStatus: 'hold',
          narrative: 'The pipes are laid.',
          submission: found.id,
        })
        expect(update.title).toMatch(/^New evidence: The pipes are laid\./)
        expect(update.attribution ?? null).toBe(attribution)
      }
    })

    it('lets a moderator remove a sender’s details, with no copy left behind', async () => {
      const res = await submit({ name: 'Remove me', contact: 'remove@example.org' })
      const { reference } = (await res.json()) as { reference: string }
      const found = await latest({ reference: { equals: reference } })
      if (!found) throw new Error('No submission')
      await payload.update({
        collection: 'submissions',
        id: found.id,
        data: { name: null, contact: null },
        user: await moderator(),
        overrideAccess: false,
      })
      const after = await payload.findByID({
        collection: 'submissions',
        id: found.id,
        overrideAccess: true,
      })
      expect(after.name ?? null).toBeNull()
      expect(after.contact ?? null).toBeNull()
      // Submissions keep no version history, so nothing else holds them.
      expect(payload.collections.submissions.config.versions).toBeFalsy()
    })
  })

  describe('the daily digest and the dashboard', () => {
    it('emails moderators the day’s new submissions, and removes old spam', async () => {
      const res = await submit({ text: 'Digest me.' })
      const { reference } = (await res.json()) as { reference: string }
      const spam = await latest({ reference: { equals: reference } })
      const old = await submit({ text: 'Old spam.' })
      const oldRef = ((await old.json()) as { reference: string }).reference
      const oldDoc = await latest({ reference: { equals: oldRef } })
      if (!spam || !oldDoc) throw new Error('No submissions')
      await payload.update({
        collection: 'submissions',
        id: oldDoc.id,
        data: { status: 'spam' },
        overrideAccess: true,
      })
      // As if marked spam long ago.
      await payload.db.updateOne({
        collection: 'submissions',
        id: oldDoc.id,
        data: { updatedAt: new Date(Date.now() - 200 * 24 * 60 * 60_000).toISOString() },
        req: {} as PayloadRequest,
      })
      const info = vi.spyOn(payload.logger, 'info')
      const { sent, removed } = await submissionDigest(payload)
      expect(sent).toBeGreaterThan(0)
      expect(removed).toBeGreaterThanOrEqual(1)
      const logged = info.mock.calls
        .map((call) => JSON.stringify(call))
        .find((c) => c.includes('daily digest'))
      expect(logged).toContain(reference)
      info.mockRestore()

      const counts = await submissionCounts(payload)
      expect(counts.waiting).toBeGreaterThan(0)
      expect(counts.received).toBeGreaterThan(counts.changed)
    })
  })

  describe('the newsletter (section 13.9)', () => {
    it('subscribes nobody until the emailed link is confirmed', async () => {
      const email = `reader-${word}@example.org`
      const info = vi.spyOn(payload.logger, 'info')
      const send = vi.spyOn(payload, 'sendEmail')
      const res = await subscribe({ email })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      const message = info.mock.calls
        .map((call) => JSON.stringify(call))
        .find((c) => c.includes('newsletter confirmation'))
      info.mockRestore()
      // The address and the token never go in the log (section 13.7). The link does.
      expect(message).not.toContain(email)
      expect(message).toContain('/en/newsletter?token=[redacted]')
      // The email itself carries the token.
      const sent = send.mock.calls.map(([args]) => args as { to?: string; text?: string })
      send.mockRestore()
      const mail = sent.find((m) => m.to === email)
      const token = mail?.text?.match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? ''
      expect(token).not.toBe('')
      const pending = await payload.find({
        collection: 'newsletter-signups',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
      expect(pending.docs[0]?.confirmed).toBe(false)

      const confirm = (value: string) =>
        respondV1Post(
          new Request('http://localhost/api/v1/subscriptions/confirm', {
            method: 'POST',
            body: JSON.stringify({ token: value }),
            headers: { 'content-type': 'application/json', ...from() },
          }),
          '/subscriptions/confirm',
          getPayload,
        )
      expect(await (await confirm('not-the-token-at-all-xx')).json()).toEqual({ confirmed: false })
      expect(await (await confirm(token)).json()).toEqual({ confirmed: true })
      // A link works once.
      expect(await (await confirm(token)).json()).toEqual({ confirmed: false })
      const done = await payload.find({
        collection: 'newsletter-signups',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
      expect(done.docs[0]?.confirmed).toBe(true)

      // Signing up again says the same, and sends nothing.
      const again = vi.spyOn(payload.logger, 'info')
      expect(await (await subscribe({ email: email.toUpperCase() })).json()).toEqual({ ok: true })
      expect(
        again.mock.calls.some((call) => JSON.stringify(call).includes('newsletter confirmation')),
      ).toBe(false)
      again.mockRestore()
      await payload.delete({
        collection: 'newsletter-signups',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
    })

    it('refuses a bad address and a missing captcha', async () => {
      expect((await subscribe({ email: 'not an email' })).status).toBe(400)
      expect((await subscribe({ email: `x-${word}@example.org`, captcha: 'nope' })).status).toBe(
        403,
      )
    })
  })

  it('hands out a fresh captcha challenge that no cache keeps', async () => {
    const result = await handleV1(payload, '/captcha', new URLSearchParams({ locale: 'en' }))
    expect(result?.status).toBe(200)
    expect(result?.body).toMatchObject({ kind: 'proof-of-work' })
    const res = await respondV1(
      new Request('http://localhost/api/v1/captcha?locale=en'),
      '/captcha',
      getPayload,
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(held).toBeTruthy()
  })
})
