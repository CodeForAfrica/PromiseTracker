import { createLocalTransport, getPayload } from '@promisetracker/cms'
import type { CountryCode } from '@promisetracker/plugin-core'
import { guessMapping, runImportPlan, setTagRefresher } from '@promisetracker/plugin-core'
import { createSdk, isNotAvailable } from '@promisetracker/sdk'
import type { Payload } from 'payload'
import { createPayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { unusedCountryCodes } from '../countries'

/**
 * Claim updates, evidence and rating reviews (sections 7.6 and 8.4), with a
 * fictional actor and claims in a small country no one tracks.
 */
describe('claim updates', () => {
  let payload: Payload
  let code: CountryCode
  let country: string
  let actor: string
  let topic: string
  const users: Record<'editor' | 'contributor', { id: string }> = {
    editor: { id: '' },
    contributor: { id: '' },
  }
  const sdk = createSdk(createLocalTransport())
  // The page tags refreshed, for the tests that check them.
  const refreshed: string[] = []
  const as = (role: keyof typeof users) => ({ ...users[role], collection: 'users' }) as never

  const claim = async (slug: string, extra: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'claims',
      locale: 'en',
      data: {
        title: `A pledge, ${slug}`,
        slug,
        actor,
        topic,
        deadline: '2027',
        sourceUrl: 'https://example.org/manifesto',
        recordStatus: 'ready',
        verification: { verdict: 'verified' },
        ...extra,
      } as never,
      overrideAccess: true,
    })
  const evidence = async (link: string) =>
    payload.create({
      collection: 'evidence',
      locale: 'en',
      data: { title: `Report at ${link}`, kind: 'article', link, finding: 'What it shows.' },
      overrideAccess: false,
      user: as('editor'),
    })
  const update = async (data: Record<string, unknown>, role: keyof typeof users = 'editor') =>
    payload.create({
      collection: 'claim-updates',
      locale: 'en',
      data: { title: 'Something happened', recordStatus: 'ready', ...data } as never,
      overrideAccess: false,
      user: as(role),
    })
  const read = async (id: string) =>
    payload.findByID({ collection: 'claims', id, depth: 0, overrideAccess: true })
  const reviewsOf = async (id: string) =>
    (
      await payload.find({
        collection: 'rating-reviews',
        where: { claim: { equals: id } },
        sort: 'date',
        depth: 0,
        overrideAccess: true,
      })
    ).docs
  const confirm = async (id: string, role: keyof typeof users) => {
    const endpoint = payload.collections.claims.config.endpoints
      ? payload.collections.claims.config.endpoints.find((e) => e.path === '/:id/confirm-rating')
      : undefined
    if (!endpoint) throw new Error('No confirm-rating endpoint.')
    const req = await createPayloadRequest({ payload, user: as(role) })
    req.routeParams = { id }
    return endpoint.handler(req)
  }

  beforeAll(async () => {
    payload = await getPayload()
    // No site to refresh in these tests.
    setTagRefresher(async (tags) => {
      refreshed.push(...tags)
    })
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
    const office = await payload.create({
      collection: 'offices',
      locale: 'en',
      data: { name: 'President', areaType: 'country', holdersPerSeat: 1, order: 1, country },
      overrideAccess: true,
    })
    actor = (
      await payload.create({
        collection: 'actors',
        data: { name: 'Amina Wanjiru', kind: 'person', country, recordStatus: 'ready' },
        overrideAccess: true,
      })
    ).id
    await payload.create({
      collection: 'terms',
      data: { actor, office: office.id, startsOn: '2022-09-13T12:00:00.000Z' },
      overrideAccess: true,
    })
    topic = (
      await payload.create({
        collection: 'topics',
        locale: 'en',
        data: { name: 'Updates test topic' },
        overrideAccess: true,
      })
    ).id
    for (const role of ['editor', 'contributor'] as const) {
      users[role] = await payload.create({
        collection: 'users',
        data: {
          email: `${role}-updates-${code}@example.org`,
          password: 'a-test-password-only',
          name: `Updates test ${role}`,
          roles: [role],
        },
        overrideAccess: true,
      })
    }
  })

  afterAll(async () => {
    // Deleting a claim for good deletes its updates and reviews too.
    for (const collection of ['claims', 'terms', 'actors', 'offices'] as const) {
      await payload.delete({
        collection,
        where: { country: { equals: country } },
        overrideAccess: true,
        trash: true,
      })
    }
    await payload.delete({
      collection: 'evidence',
      where: { link: { like: `example.org/${code}` } },
      overrideAccess: true,
      trash: true,
    })
    await payload.delete({ collection: 'topics', id: topic, overrideAccess: true })
    await payload.delete({ collection: 'countries', id: country, overrideAccess: true })
    await payload.delete({
      collection: 'users',
      where: { id: { in: [users.editor.id, users.contributor.id] } },
      overrideAccess: true,
    })
  })

  it('sets the claim’s rating, dates and count when an update is published', async () => {
    const doc = await claim('water')
    expect(doc.currentRating).toBe('unstarted')
    const proof = await evidence(`https://example.org/${code}/water-1`)
    const first = await update({
      claim: doc.id,
      date: '2023-03',
      rating: 'in-progress',
      evidence: [proof.id],
    })
    expect(first.kind).toBe('first-rating')
    const rated = await read(doc.id)
    expect(rated.currentRating).toBe('in-progress')
    expect(rated.ratedOn).toBe('2023-03-01T00:00:00.000Z')
    expect(rated.updateCount).toBe(1)
    expect(rated.lastReviewedAt).toBeTruthy()
    const reviews = await reviewsOf(doc.id)
    expect(reviews.map((r) => r.outcome)).toEqual(['changed'])
  })

  it('lets nobody type the current rating', async () => {
    const doc = await claim('typed')
    const saved = await payload.update({
      collection: 'claims',
      id: doc.id,
      locale: 'en',
      data: { currentRating: 'completed', ratedOn: '2020-01-01T00:00:00.000Z' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect(saved.currentRating).toBe('unstarted')
    expect(saved.ratedOn ?? null).toBeNull()
  })

  it('needs evidence for a change of rating, and a rating on the claim’s scale', async () => {
    const doc = await claim('roads')
    await expect(update({ claim: doc.id, date: '2023-05', rating: 'in-progress' })).rejects.toThrow(
      /needs at least one piece of evidence/,
    )
    await expect(update({ claim: doc.id, date: '2023-05', rating: 'kept' })).rejects.toThrow(
      /on the claim's scale/,
    )
    // No change of rating, so no evidence needed.
    const same = await update({ claim: doc.id, date: '2023-05', rating: 'unstarted' })
    expect(same.kind).toBe('first-rating')
  })

  it('lets only those who rate claims add updates', async () => {
    const doc = await claim('schools')
    const proof = await evidence(`https://example.org/${code}/schools-1`)
    await expect(
      update(
        { claim: doc.id, date: '2023', rating: 'in-progress', evidence: [proof.id] },
        'contributor',
      ),
    ).rejects.toThrow()
  })

  it('ignores a held update, and goes back when an update is removed', async () => {
    const doc = await claim('clinics')
    const one = await evidence(`https://example.org/${code}/clinics-1`)
    const two = await evidence(`https://example.org/${code}/clinics-2`)
    const first = await update({
      claim: doc.id,
      date: '2023-02-10',
      rating: 'in-progress',
      evidence: [one.id],
    })
    const held = await update({
      claim: doc.id,
      date: '2024-01',
      rating: 'stalled',
      evidence: [two.id],
      recordStatus: 'hold',
    })
    expect((await read(doc.id)).currentRating).toBe('in-progress')
    await payload.update({
      collection: 'claim-updates',
      id: held.id,
      data: { recordStatus: 'ready' },
      overrideAccess: true,
    })
    const both = await read(doc.id)
    expect(both.currentRating).toBe('stalled')
    expect(both.updateCount).toBe(2)
    expect(both.ratedOn).toBe('2024-01-01T00:00:00.000Z')
    await payload.delete({ collection: 'claim-updates', id: held.id, overrideAccess: true })
    const back = await read(doc.id)
    expect(back.currentRating).toBe('in-progress')
    expect(back.updateCount).toBe(1)
    await payload.delete({ collection: 'claim-updates', id: first.id, overrideAccess: true })
    const none = await read(doc.id)
    expect(none.currentRating).toBe('unstarted')
    expect(none.updateCount).toBe(0)
  })

  it('puts a claim saved with no update back on its starting rating', async () => {
    const doc = await claim('harbours')
    const proof = await evidence(`https://example.org/${code}/harbours-1`)
    const only = await update({
      claim: doc.id,
      date: '2023',
      rating: 'in-progress',
      evidence: [proof.id],
    })
    // Saved while rated, so its latest version holds the rating.
    await payload.update({
      collection: 'claims',
      id: doc.id,
      locale: 'en',
      data: { title: 'A pledge, harbours, renamed' },
      overrideAccess: true,
    })
    await payload.delete({ collection: 'claim-updates', id: only.id, overrideAccess: true })
    // A save with no user, as an import makes, starts from that version.
    const saved = await payload.update({
      collection: 'claims',
      id: doc.id,
      locale: 'en',
      data: { title: 'A pledge, harbours' },
      overrideAccess: true,
    })
    expect(saved.currentRating).toBe('unstarted')
    expect((await read(doc.id)).currentRating).toBe('unstarted')
  })

  it('keeps a rating an older update gave from being deleted from its scale', async () => {
    const rating = (slug: string, value: number, isStarting: boolean) => ({
      slug,
      label: slug,
      tier: 'checked',
      definition: `The claim is ${slug}.`,
      colour: '#e4e5e8',
      textColour: '#2a2c26',
      value,
      isStarting,
    })
    const scale = await payload.create({
      collection: 'rating-scales',
      locale: 'en',
      data: {
        name: `History ${code}`,
        bestValue: 2,
        worstValue: 1,
        tiers: [{ slug: 'checked', label: 'Checked', colour: '#1b4fd8' }],
        ratings: [rating('unproven', 1, true), rating('proven', 2, false)],
      },
      overrideAccess: true,
    })
    const type = await payload.create({
      collection: 'claim-types',
      locale: 'en',
      data: { name: 'History test', slug: `history-${code}`, ratingScale: scale.id },
      overrideAccess: true,
    })
    const doc = await claim('history', { type: type.id })
    try {
      const one = await evidence(`https://example.org/${code}/history-1`)
      const two = await evidence(`https://example.org/${code}/history-2`)
      await update({ claim: doc.id, date: '2023', rating: 'proven', evidence: [one.id] })
      await update({ claim: doc.id, date: '2024', rating: 'unproven', evidence: [two.id] })
      // No claim carries "proven" now, but an update in its history does.
      expect((await read(doc.id)).currentRating).toBe('unproven')
      const refused = await payload
        .update({
          collection: 'rating-scales',
          id: scale.id,
          locale: 'en',
          data: { ratings: [rating('unproven', 1, true)] },
          overrideAccess: true,
        })
        .then(
          () => null,
          (error: unknown) => error,
        )
      const { errors } = (Reflect.get(Object(refused), 'data') ?? {}) as {
        errors?: { message: string }[]
      }
      expect(errors?.[0]?.message).toMatch(
        /"proven" is used by 1 claim\(s\), now or in their history/,
      )
    } finally {
      await payload.delete({ collection: 'claims', id: doc.id, overrideAccess: true, trash: true })
      await payload.delete({ collection: 'claim-types', id: type.id, overrideAccess: true })
      await payload.delete({ collection: 'rating-scales', id: scale.id, overrideAccess: true })
    }
  })

  it('confirms a rating with a review, and no public update', async () => {
    const doc = await claim('bridges')
    const before = await read(doc.id)
    expect(before.lastReviewedAt ?? null).toBeNull()
    const refused = await confirm(doc.id, 'contributor')
    expect(refused.status).toBe(403)
    const res = await confirm(doc.id, 'editor')
    expect(res.status).toBe(200)
    const after = await read(doc.id)
    expect(after.lastReviewedAt).toBeTruthy()
    expect(after.updateCount).toBe(0)
    expect(after.currentRating).toBe('unstarted')
    const reviews = await reviewsOf(doc.id)
    expect(reviews.map((r) => [r.outcome, r.rating])).toEqual([['confirmed', 'unstarted']])
  })

  it('shows the timeline, evidence and citation on the claim, and the full history', async () => {
    const doc = await claim('housing')
    const one = await evidence(`https://example.org/${code}/housing-1`)
    const two = await evidence(`https://example.org/${code}/housing-2`)
    await update({
      claim: doc.id,
      date: '2023-01',
      rating: 'in-progress',
      title: 'Building starts',
      evidence: [one.id],
    })
    await update({
      claim: doc.id,
      date: '2023-06',
      rating: 'stalled',
      kind: 'correction',
      title: 'We got the start date wrong',
      evidence: [two.id],
    })
    // On hold, so not public, and nor is its evidence.
    const secret = await evidence(`https://example.org/${code}/housing-secret`)
    await update({
      claim: doc.id,
      date: '2024-01',
      rating: 'completed',
      title: 'Not yet public',
      evidence: [secret.id],
      recordStatus: 'hold',
    })
    const found = await sdk.getClaim('en', code, 'housing')
    if (isNotAvailable(found)) throw new Error('The claim is not public.')
    expect(found.rating?.slug).toBe('stalled')
    expect(found.updateCount).toBe(2)
    expect(found.timeline.map((u) => [u.title, u.kind, u.rating?.slug])).toEqual([
      ['We got the start date wrong', 'correction', 'stalled'],
      ['Building starts', 'first-rating', 'in-progress'],
    ])
    expect(found.evidence.map((e) => e.url)).toEqual([
      `https://example.org/${code}/housing-2`,
      `https://example.org/${code}/housing-1`,
    ])
    expect(found.citation.url).toMatch(new RegExp(`/en/${code}/p/housing$`))
    expect(found.citation.text).toContain(found.citation.url)
    expect(found.citation.text).toContain('Rating last reviewed on')

    const history = await sdk.getClaimHistory('en', code, 'housing')
    if (isNotAvailable(history)) throw new Error('The history is not public.')
    expect(history.claim.slug).toBe('housing')
    expect(history.updates.map((u) => u.title)).toEqual([
      'We got the start date wrong',
      'Building starts',
    ])

    const person = await sdk.getActor('en', code, 'amina-wanjiru')
    if (isNotAvailable(person)) throw new Error('The actor is not public.')
    expect(person.latestChanges[0]?.update.title).toBe('We got the start date wrong')
    expect(person.latestChanges[0]?.claim.slug).toBe('housing')
    expect(person.latestChanges.map((c) => c.update.title)).not.toContain('Not yet public')
  })

  it('lets a draft change nothing until it is published', async () => {
    const doc = await claim('dams')
    const proof = await evidence(`https://example.org/${code}/dams-1`)
    const draft = await payload.create({
      collection: 'claim-updates',
      locale: 'en',
      draft: true,
      data: {
        claim: doc.id,
        date: '2023-04',
        rating: 'in-progress',
        title: 'Work starts',
        evidence: [proof.id],
        recordStatus: 'ready',
      } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    const untouched = await read(doc.id)
    expect(untouched.currentRating).toBe('unstarted')
    expect(untouched.updateCount).toBe(0)
    expect(await reviewsOf(doc.id)).toEqual([])

    await payload.update({
      collection: 'claim-updates',
      id: draft.id,
      locale: 'en',
      data: { _status: 'published' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect((await read(doc.id)).currentRating).toBe('in-progress')
    expect((await reviewsOf(doc.id)).map((r) => r.outcome)).toEqual(['changed'])

    // A draft of a new rating on the published update changes nothing either.
    const two = await evidence(`https://example.org/${code}/dams-2`)
    await payload.update({
      collection: 'claim-updates',
      id: draft.id,
      locale: 'en',
      draft: true,
      data: { rating: 'stalled', evidence: [proof.id, two.id] } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect((await read(doc.id)).currentRating).toBe('in-progress')
    expect(await reviewsOf(doc.id)).toHaveLength(1)
  })

  it('counts only published evidence as a claim’s source, and hides drafts from guests', async () => {
    const doc = await claim('wells', { sourceUrl: null })
    expect(doc.publishedIn).toEqual([])
    const proof = await evidence(`https://example.org/${code}/wells-1`)
    const draft = await payload.create({
      collection: 'claim-updates',
      locale: 'en',
      draft: true,
      data: {
        claim: doc.id,
        date: '2023-04',
        rating: 'in-progress',
        title: 'Wells dug',
        evidence: [proof.id],
        recordStatus: 'ready',
      } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect((await read(doc.id)).publishedIn).toEqual([])
    const guest = await payload.find({
      collection: 'claim-updates',
      where: { claim: { equals: doc.id } },
      overrideAccess: false,
    })
    expect(guest.docs).toEqual([])
    await payload.update({
      collection: 'claim-updates',
      id: draft.id,
      locale: 'en',
      data: { _status: 'published' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect((await read(doc.id)).publishedIn).toEqual(['en'])
  })

  it('checks a backdated update against the update before it by date', async () => {
    const doc = await claim('bridges-2')
    const proof = await evidence(`https://example.org/${code}/bridges-2-1`)
    await update({ claim: doc.id, date: '2023-06', rating: 'in-progress', evidence: [proof.id] })
    // Before June, the rating was the starting one, so a change then needs evidence.
    await expect(update({ claim: doc.id, date: '2023-01', rating: 'stalled' })).rejects.toThrow(
      /needs at least one piece of evidence/,
    )
    const same = await update({ claim: doc.id, date: '2023-01', rating: 'unstarted' })
    expect(same.id).toBeTruthy()
    expect((await read(doc.id)).currentRating).toBe('in-progress')
  })

  it('compares updates on the same date by when they were recorded', async () => {
    const doc = await claim('tunnels')
    const proof = await evidence(`https://example.org/${code}/tunnels-1`)
    const first = await update({ claim: doc.id, date: '2023', rating: 'unstarted' })
    await update({ claim: doc.id, date: '2023', rating: 'in-progress', evidence: [proof.id] })
    // The first update came before the second, so fixing its title needs no evidence.
    const fixed = await payload.update({
      collection: 'claim-updates',
      id: first.id,
      locale: 'en',
      data: { title: 'A corrected title' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect(fixed.title).toBe('A corrected title')
  })

  it('stops counting evidence that is withdrawn, and counts it again when restored', async () => {
    const doc = await claim('quarries', { sourceUrl: null })
    const proof = await evidence(`https://example.org/${code}/quarries-1`)
    await update({ claim: doc.id, date: '2023', rating: 'in-progress', evidence: [proof.id] })
    expect((await read(doc.id)).publishedIn).toEqual(['en'])
    await payload.update({
      collection: 'evidence',
      id: proof.id,
      data: { deletedAt: new Date().toISOString() } as never,
      overrideAccess: true,
    })
    expect((await read(doc.id)).publishedIn).toEqual([])
    await payload.update({
      collection: 'evidence',
      id: proof.id,
      data: { deletedAt: null } as never,
      trash: true,
      overrideAccess: true,
    })
    expect((await read(doc.id)).publishedIn).toEqual(['en'])
  })

  it('refuses to publish a draft whose rating is not on the scale', async () => {
    const doc = await claim('mills')
    const draft = await payload.create({
      collection: 'claim-updates',
      locale: 'en',
      draft: true,
      data: { claim: doc.id, date: '2023', rating: 'kept', title: 'Off the scale' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    await expect(
      payload.update({
        collection: 'claim-updates',
        id: draft.id,
        locale: 'en',
        data: { _status: 'published', recordStatus: 'ready' } as never,
        overrideAccess: false,
        user: as('editor'),
      }),
    ).rejects.toThrow(/on the claim's scale/)
  })

  it('saves an unfinished draft without the checks a published update needs', async () => {
    const doc = await claim('canals')
    const draft = await payload.create({
      collection: 'claim-updates',
      locale: 'en',
      draft: true,
      data: { claim: doc.id, title: 'Notes so far' } as never,
      overrideAccess: false,
      user: as('editor'),
    })
    expect(draft.id).toBeTruthy()
    expect((await read(doc.id)).updateCount).toBe(0)
  })

  it('refuses a date that does not exist', async () => {
    const doc = await claim('ports')
    const proof = await evidence(`https://example.org/${code}/ports-1`)
    await expect(
      update({ claim: doc.id, date: '2023-02-30', rating: 'in-progress', evidence: [proof.id] }),
    ).rejects.toThrow()
    await expect(
      update({ claim: doc.id, date: '2023-13', rating: 'in-progress', evidence: [proof.id] }),
    ).rejects.toThrow()
  })

  it('refreshes the claim pages that cite a piece of evidence when it changes', async () => {
    const doc = await claim('railways')
    const proof = await evidence(`https://example.org/${code}/railways-1`)
    await update({ claim: doc.id, date: '2023', rating: 'in-progress', evidence: [proof.id] })
    refreshed.length = 0
    await payload.update({
      collection: 'evidence',
      id: proof.id,
      locale: 'en',
      data: { finding: 'A corrected finding.' },
      overrideAccess: false,
      user: as('editor'),
    })
    expect(refreshed).toContain(`claims:${code}`)
  })

  it('answers a malformed claim id with not found', async () => {
    expect((await confirm('not-an-id', 'editor')).status).toBe(404)
  })

  it('keeps evidence from the public outside published updates', async () => {
    await expect(payload.find({ collection: 'evidence', overrideAccess: false })).rejects.toThrow()
  })

  it('imports updates by claim and date, with their evidence', async () => {
    await claim('markets')
    const headings = [
      'Claim',
      'Date',
      'Rating',
      'Title',
      'Title (fr)',
      'Evidence link',
      'Evidence title',
      'Evidence publisher',
    ]
    const link = `https://example.org/${code}/markets-1`
    const rows = [
      {
        row: 1,
        values: [
          'markets',
          '2023-04',
          'in-progress',
          'Markets open',
          'Les marchés ouvrent',
          link,
          'Opening report',
          'The Paper',
        ],
      },
      { row: 2, values: ['no-such-claim', '2023-04', 'in-progress', 'Nothing', '', '', '', ''] },
      { row: 3, values: ['A pledge, markets', '2023-09', 'kept', 'Off the scale', '', '', '', ''] },
    ]
    const mapping = guessMapping('claim-updates', headings)
    const run = (commit: boolean) =>
      runImportPlan(payload, {
        target: 'claim-updates',
        country,
        headings,
        rows,
        mapping,
        commit,
        onCreate: { recordStatus: 'ready' },
        requestedBy: users.editor.id,
      })
    const preview = await run(false)
    expect(preview.counts).toMatchObject({ create: 1, failed: 2 })
    expect(preview.errors.map((e) => e.line)).toEqual([3, 4])
    expect(preview.errors[0]?.message).toMatch(/not in this country/)
    expect(preview.errors[1]?.message).toMatch(/not on the claim's scale/)
    expect((await run(true)).counts).toMatchObject({ create: 1, failed: 2 })
    expect((await run(true)).counts).toMatchObject({ create: 0, update: 0, skip: 1 })

    // The review the import recorded names the editor who ran it.
    const markets = await payload.find({
      collection: 'claims',
      where: { and: [{ country: { equals: country } }, { slug: { equals: 'markets' } }] },
      overrideAccess: true,
    })
    const reviews = await reviewsOf(markets.docs[0]?.id ?? '')
    expect(reviews.map((r) => r.reviewer)).toEqual([users.editor.id])

    const found = await sdk.getClaim('en', code, 'markets')
    if (isNotAvailable(found)) throw new Error('The claim is not public.')
    expect(found.rating?.slug).toBe('in-progress')
    expect(found.timeline[0]?.evidence[0]).toMatchObject({
      url: link,
      title: 'Opening report',
      publisher: 'The Paper',
    })
    const fr = await sdk.getClaimHistory('fr', code, 'markets')
    if (!isNotAvailable(fr)) expect(fr.updates[0]?.title).toBe('Les marchés ouvrent')
  })

  it('deletes a claim for good with its updates and reviews', async () => {
    const doc = await claim('ferries')
    const proof = await evidence(`https://example.org/${code}/ferries-1`)
    await update({ claim: doc.id, date: '2023', rating: 'in-progress', evidence: [proof.id] })
    await payload.delete({ collection: 'claims', id: doc.id, overrideAccess: true, trash: true })
    const left = await payload.find({
      collection: 'claim-updates',
      where: { claim: { equals: doc.id } },
      trash: true,
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)
    expect(await reviewsOf(doc.id)).toEqual([])
  })

  it('queues one job that refreshes the figures after rating changes', async () => {
    const { docs } = await payload.find({
      collection: 'payload-jobs',
      where: {
        and: [{ taskSlug: { equals: 'refreshCounts' } }, { completedAt: { exists: false } }],
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const ours = docs.filter((job) => (job.input as { country?: string }).country === code)
    // Many rating changes above, and a newer job replaces one still waiting.
    expect(ours).toHaveLength(1)
  })
})
