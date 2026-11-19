import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { RatingScale } from '@promisetracker/contract'
import { RatingScale as RatingScaleSchema } from '@promisetracker/contract'
import {
  AA_CONTRAST,
  ClaimTypes,
  checkScale,
  contrastRatio,
  DELIVERY_SCALE,
  formatRatio,
  isHexColour,
  PROMISE_TYPE,
  RatingScales,
} from '@promisetracker/plugin-core'
import {
  orderedRatings,
  RatingChip,
  RatingLegend,
  TierBar,
  tierBarLabel,
  tierCount,
} from '@promisetracker/ui'
import type { PayloadRequest } from 'payload'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

/** The default scale as the API returns it in English. */
const delivery: RatingScale = RatingScaleSchema.parse({
  id: 'delivery',
  name: DELIVERY_SCALE.name.en,
  bestValue: DELIVERY_SCALE.bestValue,
  worstValue: DELIVERY_SCALE.worstValue,
  tiers: DELIVERY_SCALE.tiers.map((t) => ({ ...t, label: t.label.en })),
  ratings: DELIVERY_SCALE.ratings.map((r) => ({
    ...r,
    label: r.label.en,
    definition: r.definition.en,
    retired: false,
  })),
})

type Row = Record<string, unknown>

/** The default scale as an editor would save it. */
const stored = (): { bestValue: number; worstValue: number; tiers: Row[]; ratings: Row[] } => ({
  bestValue: 5,
  worstValue: 1,
  tiers: DELIVERY_SCALE.tiers.map((t, i) => ({ ...t, id: `t${i}`, label: t.label.en })),
  ratings: DELIVERY_SCALE.ratings.map((r, i) => ({
    ...r,
    id: `r${i}`,
    label: r.label.en,
    definition: r.definition.en,
    retired: false,
  })),
})

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element)

describe('colour contrast (section 10.5)', () => {
  it('measures contrast as WCAG 2 does', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5)
    // #767676 on white is the classic AA borderline: just over 4.5.
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(AA_CONTRAST)
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(AA_CONTRAST)
  })

  it('gives no ratio for something that is not a colour', () => {
    expect(contrastRatio('blue', '#fff')).toBeNull()
    expect(isHexColour('#12345')).toBe(false)
    expect(isHexColour('#1b4fd8')).toBe(true)
  })

  it('rounds down, so a pass is never overstated', () => {
    expect(formatRatio(4.499)).toBe('4.49:1')
  })

  it('every default rating meets WCAG AA', () => {
    for (const r of DELIVERY_SCALE.ratings) {
      expect(contrastRatio(r.textColour, r.colour), r.slug).toBeGreaterThanOrEqual(AA_CONTRAST)
    }
  })

  it('every default tier colour stands out on white, as graphics need 3:1', () => {
    for (const t of DELIVERY_SCALE.tiers) {
      expect(contrastRatio(t.colour, '#ffffff'), t.slug).toBeGreaterThanOrEqual(3)
    }
  })
})

describe('the default Delivery scale (section 7.4)', () => {
  it('has the six ratings in three tiers, as the table says', () => {
    const byTier = Object.fromEntries(
      DELIVERY_SCALE.tiers.map((t) => [
        t.label.en,
        DELIVERY_SCALE.ratings.filter((r) => r.tier === t.slug).map((r) => r.label.en),
      ]),
    )
    expect(byTier).toEqual({
      'Promise kept': ['Completed', 'In Progress'],
      Uncertain: ['Unstarted', 'Inconclusive'],
      'Promise not kept': ['Behind Schedule', 'Stalled'],
    })
  })

  it('starts claims at Unstarted, and needs a deadline only for the two not-kept ratings', () => {
    expect(DELIVERY_SCALE.ratings.filter((r) => r.isStarting).map((r) => r.slug)).toEqual([
      'unstarted',
    ])
    expect(DELIVERY_SCALE.ratings.filter((r) => r.needsDeadline).map((r) => r.slug)).toEqual([
      'behind-schedule',
      'stalled',
    ])
  })

  it('is in English and French, and Inconclusive means there is not yet enough evidence', () => {
    for (const r of DELIVERY_SCALE.ratings) {
      expect(r.label.fr && r.definition.fr, r.slug).toBeTruthy()
    }
    const inconclusive = DELIVERY_SCALE.ratings.find((r) => r.slug === 'inconclusive')
    expect(inconclusive?.definition.en).toMatch(/not yet enough evidence/)
  })

  it('passes its own rules, and the Promise type uses it', () => {
    expect(checkScale(stored(), undefined)).toEqual([])
    expect(PROMISE_TYPE).toMatchObject({ slug: 'promise', name: { en: 'Promise', fr: 'Promesse' } })
  })
})

describe('the rules a scale keeps', () => {
  const paths = (data: Record<string, unknown>, previous?: Record<string, unknown>) =>
    checkScale(data, previous).map((e) => e.path)

  it('refuses a rating in a tier that does not exist', () => {
    const data = stored()
    data.ratings[0] = { ...data.ratings[0], tier: 'nowhere' } as (typeof data.ratings)[number]
    expect(paths(data)).toEqual(['ratings.0.tier'])
  })

  it('refuses two ratings or tiers with one slug', () => {
    const data = stored()
    data.ratings[1] = { ...data.ratings[1], slug: 'completed' } as (typeof data.ratings)[number]
    data.tiers[1] = { ...data.tiers[1], slug: 'kept' } as (typeof data.tiers)[number]
    expect(paths(data)).toEqual(expect.arrayContaining(['ratings.1.slug', 'tiers.1.slug']))
  })

  it('needs exactly one starting rating, which is not retired', () => {
    const none = stored()
    none.ratings = none.ratings.map((r) => ({ ...r, isStarting: false }))
    expect(paths(none)).toEqual(['ratings.0.isStarting'])

    const two = stored()
    two.ratings = two.ratings.map((r, i) => ({ ...r, isStarting: i === 0 || r.isStarting }))
    expect(paths(two)).toEqual(['ratings.2.isStarting'])

    const retired = stored()
    retired.ratings = retired.ratings.map((r) => ({ ...r, retired: r.isStarting }))
    expect(paths(retired)).toEqual(['ratings.2.retired'])
  })

  it('never lets a saved rating change its slug', () => {
    const before = stored()
    const after = stored()
    after.ratings[0] = { ...after.ratings[0], slug: 'done' } as (typeof after.ratings)[number]
    expect(checkScale(after, before)).toEqual([
      expect.objectContaining({
        path: 'ratings.0.slug',
        message: expect.stringMatching(/never changes/),
      }),
    ])
    // A new row may take any free slug.
    const added = stored()
    added.ratings.push({
      ...after.ratings[0],
      id: 'new',
      slug: 'abandoned',
    } as (typeof added.ratings)[number])
    expect(checkScale(added, before)).toEqual([])
  })

  it('keeps every value between the worst and the best', () => {
    const data = stored()
    data.ratings[0] = { ...data.ratings[0], value: 9 } as (typeof data.ratings)[number]
    expect(paths(data)).toEqual(['ratings.0.value'])
    expect(paths({ ...stored(), bestValue: 1 })).toContain('bestValue')
  })
})

describe('who manages ratings (section 13.2)', () => {
  const as = (role: string | null) =>
    ({ req: { user: role ? { roles: [role] } : null } as unknown as PayloadRequest }) as never
  const rule = (collection: typeof RatingScales, op: 'read' | 'create' | 'update' | 'delete') => {
    const fn = collection.access?.[op]
    if (typeof fn !== 'function') throw new Error(`no ${op} rule`)
    return (role: string | null) => fn(as(role))
  }

  it('lets only super-admins change scales and types', () => {
    for (const collection of [RatingScales, ClaimTypes]) {
      for (const op of ['create', 'update', 'delete'] as const) {
        expect(rule(collection, op)('super-admin')).toBe(true)
        for (const role of ['editor', 'contributor', 'reviewer', 'moderator', 'viewer', null]) {
          expect(rule(collection, op)(role), `${collection.slug} ${op} ${role}`).toBe(false)
        }
      }
    }
  })

  it('lets anyone read them, since the site explains every rating it shows', () => {
    expect(rule(RatingScales, 'read')(null)).toBe(true)
    expect(rule(ClaimTypes, 'read')(null)).toBe(true)
  })

  it('keeps every change in the version history', () => {
    expect(RatingScales.versions).toEqual({ maxPerDoc: 0 })
  })
})

describe('rating atoms (packages/ui)', () => {
  const counts = { completed: 3, 'in-progress': 1, stalled: 2 }

  it('shows a chip with its label and the scale’s colours', () => {
    const [completed] = delivery.ratings
    if (!completed) throw new Error('no rating')
    const chip = html(createElement(RatingChip, { rating: completed }))
    expect(chip).toContain('>Completed<')
    expect(chip).toContain('background-color:#1b4fd8')
    expect(chip).toContain('color:#ffffff')
  })

  it('lists every rating with its label and count, and can leave out empty ones', () => {
    const all = html(createElement(RatingLegend, { scale: delivery, counts }))
    expect(all.match(/<li/g)).toHaveLength(6)
    const some = html(createElement(RatingLegend, { scale: delivery, counts, hideEmpty: true }))
    expect(some.match(/<li/g)).toHaveLength(3)
    expect(some).toContain('Stalled')
    expect(some).not.toContain('Unstarted')
  })

  it('shows a retired rating only while claims carry it', () => {
    const scale = {
      ...delivery,
      ratings: delivery.ratings.map((r) => ({
        ...r,
        retired: r.slug === 'stalled' || r.slug === 'unstarted',
      })),
    }
    const legend = html(createElement(RatingLegend, { scale, counts }))
    expect(legend).toContain('Stalled')
    expect(legend).not.toContain('Unstarted')
  })

  it('sizes the tier bar from data and names every segment in words', () => {
    const bar = html(createElement(TierBar, { scale: delivery, counts }))
    expect(bar).toContain('role="img"')
    expect(bar).toContain('aria-label="Completed: 3, In Progress: 1, Stalled: 2"')
    expect(bar).toContain('flex:4 1 0%')
    expect(bar.match(/<i /g)).toHaveLength(3)
    expect(tierBarLabel(delivery, {})).toBe('')
    expect(tierCount(delivery, counts, 'not-kept')).toBe(2)
  })

  it('follows a scale with other tiers and ratings, with nothing assumed', () => {
    const scale = RatingScaleSchema.parse({
      id: 'truth',
      name: 'Truth',
      bestValue: 2,
      worstValue: 0,
      tiers: [
        { slug: 'false', label: 'False', colour: '#c93b2c' },
        { slug: 'true', label: 'True', colour: '#17694e' },
      ],
      ratings: [
        {
          slug: 'yes',
          label: 'True',
          definition: null,
          tier: 'true',
          colour: '#17694e',
          textColour: '#fff',
          value: 2,
          needsDeadline: false,
          isStarting: false,
          retired: false,
        },
        {
          slug: 'no',
          label: 'False',
          definition: null,
          tier: 'false',
          colour: '#c93b2c',
          textColour: '#fff',
          value: 0,
          needsDeadline: false,
          isStarting: true,
          retired: false,
        },
      ],
    })
    expect(orderedRatings(scale).map((r) => r.slug)).toEqual(['no', 'yes'])
    expect(html(createElement(RatingLegend, { scale, counts: { yes: 1 } }))).toContain('>True<')
  })

  it('names no rating and holds no rating colour in packages/ui (D22)', () => {
    const dir = path.resolve(import.meta.dirname, '../../packages/ui/src')
    const source = readdirSync(dir)
      .filter((f) => /\.(ts|tsx)$/.test(f))
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
    for (const r of DELIVERY_SCALE.ratings) {
      expect(source, r.slug).not.toContain(`'${r.slug}'`)
      expect(source, r.label.en).not.toContain(r.label.en)
      // The link colour shares Completed's blue, so only the other colours are checked.
      if (r.slug !== 'completed') expect(source.toLowerCase(), r.colour).not.toContain(r.colour)
    }
  })
})
