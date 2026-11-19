import type { Figures, RatingScale, SiteInfo } from '@promisetracker/contract'
import { partialDatePrecision } from '@promisetracker/plugin-core'
import { resolveStrings } from '@promisetracker/plugin-site'
import { figureFormat, formatPartialDate, scalesOf } from '@promisetracker/ui'
import { describe, expect, it } from 'vitest'

describe('partial dates (section 7.5)', () => {
  it('knows a year, a month and a day', () => {
    expect(partialDatePrecision('2027')).toBe('year')
    expect(partialDatePrecision('2027-08')).toBe('month')
    expect(partialDatePrecision('2027-08-09')).toBe('day')
  })

  it('refuses what is not a date', () => {
    for (const value of [
      '27',
      '2027-00',
      '2027-13',
      '2027-02-30',
      '2027-08-00',
      '2027-08-32',
      '2027-08-99',
      '2027-8',
      'August 2027',
      '',
      null,
    ]) {
      expect(partialDatePrecision(value), String(value)).toBeNull()
    }
  })

  it('is written as precisely as it is known', () => {
    expect(formatPartialDate('en', { value: '2027', precision: 'year' })).toBe('2027')
    expect(formatPartialDate('en', { value: '2027-08', precision: 'month' })).toBe('August 2027')
    expect(formatPartialDate('fr', { value: '2027-08-09', precision: 'day' })).toBe('9 août 2027')
  })
})

describe('figures (section 10.4)', () => {
  const site = { locale: 'en', strings: resolveStrings('en', null) } as SiteInfo
  const figures = (total: number, form: Figures['form']): Figures => ({
    total,
    form,
    byRating: {},
    byTier: {},
  })

  it('writes counts below the threshold, as "1 of 3"', () => {
    expect(figureFormat(site, figures(3, 'counts'))(1)).toBe('1 of 3')
  })

  it('writes percentages from the threshold', () => {
    expect(figureFormat(site, figures(40, 'percentages'))(10)).toBe('25%')
  })
})

describe('figures across scales', () => {
  const rating = (slug: string, tier: string) => ({
    slug,
    label: slug,
    definition: null,
    tier,
    colour: '#1b4fd8',
    textColour: '#ffffff',
    value: 1,
    needsDeadline: false,
    isStarting: false,
    retired: false,
  })
  const scale = (id: string, slugs: string[]): RatingScale => ({
    id,
    name: id,
    bestValue: 2,
    worstValue: 1,
    tiers: [{ slug: 'one', label: 'One', colour: '#1b4fd8' }],
    ratings: slugs.map((slug) => rating(slug, 'one')),
  })

  it('splits figures by scale, each with its own total', () => {
    const site = {
      ratingScales: [scale('delivery', ['completed', 'stalled']), scale('truth', ['true'])],
    } as SiteInfo
    const figures: Figures = {
      total: 3,
      form: 'counts',
      byRating: { completed: 1, stalled: 1, true: 1 },
      byTier: {},
    }
    expect(
      scalesOf(site, figures).map((part) => [
        part.scale.id,
        part.figures.total,
        part.figures.byRating,
      ]),
    ).toEqual([
      ['delivery', 2, { completed: 1, stalled: 1 }],
      ['truth', 1, { true: 1 }],
    ])
  })
})
