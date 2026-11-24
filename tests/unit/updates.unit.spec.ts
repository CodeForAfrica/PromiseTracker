import type { ClaimUpdate, SiteInfo } from '@promisetracker/contract'
import { ClaimUpdate as ClaimUpdateSchema } from '@promisetracker/contract'
import { guessMapping, partialDateStart, planRow } from '@promisetracker/plugin-core'
import { resolveStrings } from '@promisetracker/plugin-site'
import { ClaimTimeline, LatestChanges } from '@promisetracker/ui'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

describe('the rated date of an update (section 7.6)', () => {
  it('is the first day a partial date covers', () => {
    expect(partialDateStart('2023')).toBe('2023-01-01T00:00:00.000Z')
    expect(partialDateStart('2023-08')).toBe('2023-08-01T00:00:00.000Z')
    expect(partialDateStart('2023-08-17')).toBe('2023-08-17T00:00:00.000Z')
    expect(partialDateStart('August 2023')).toBeNull()
    expect(partialDateStart(null)).toBeNull()
  })
})

describe('importing claim updates (section 9.6)', () => {
  const headings = ['Claim', 'Date', 'Rating', 'Kind', 'Title', 'Title (fr)', 'Evidence link']
  const mapping = guessMapping('claim-updates', headings)

  it('guesses the columns, including the evidence', () => {
    expect(mapping).toMatchObject({
      claim: 'Claim',
      date: 'Date',
      rating: 'Rating',
      kind: 'Kind',
      title: 'Title',
      'title:fr': 'Title (fr)',
      evidenceLink: 'Evidence link',
    })
  })

  it('finds an update by its claim and date, with no slug', () => {
    const row = planRow(
      'claim-updates',
      headings,
      mapping,
      ['Cut the price of fertiliser', '2023-08', 'completed', 'Correction', 'Cut', 'Baisse', ''],
      2,
    )
    expect(row).toMatchObject({
      slug: '',
      refs: { claim: 'cut-the-price-of-fertiliser' },
      data: { date: '2023-08', rating: 'completed', kind: 'correction', title: 'Cut' },
      translations: { fr: { title: 'Baisse' } },
      errors: [],
    })
  })

  it('says what is wrong with a row', () => {
    const row = planRow(
      'claim-updates',
      headings,
      mapping,
      ['', 'soon', '', 'rumour', '', '', ''],
      3,
    )
    expect(row.errors).toEqual([
      'Claim is empty.',
      'Date "soon" is not a date written as 2027, 2027-08 or 2027-08-09.',
      'Rating is empty.',
      'Kind "rumour" is not one of first-rating, change, correction.',
      'Title is empty.',
    ])
  })
})

describe('the timeline (sections 10.2 and 10.5)', () => {
  const site = { locale: 'en', strings: resolveStrings('en', null) } as SiteInfo
  const rating = {
    slug: 'stalled',
    label: 'Stalled',
    definition: null,
    tier: 'not-kept',
    colour: '#b42318',
    textColour: '#ffffff',
    value: 1,
    needsDeadline: true,
    isStarting: false,
    retired: false,
  }
  const update = (id: string, kind: ClaimUpdate['kind'], title: string): ClaimUpdate =>
    ClaimUpdateSchema.parse({
      id,
      date: { value: '2024-01', precision: 'month' },
      kind,
      rating,
      title,
      narrative: null,
      attribution: id === 'b' ? 'A reader in Kisumu' : null,
      evidence: [
        {
          id: `e-${id}`,
          kind: 'article',
          title: 'The report',
          publisher: 'The Paper',
          date: null,
          url: 'https://example.org/report',
          finding: null,
          thumbnail: null,
        },
      ],
    })

  it('is a real ordered list, with corrections labelled', () => {
    const html = renderToStaticMarkup(
      createElement(ClaimTimeline, {
        site,
        updates: [
          update('b', 'correction', 'We fixed a date'),
          update('a', 'change', 'Work stops'),
        ],
      }),
    )
    expect(html.startsWith('<ol')).toBe(true)
    expect(html.match(/<li/g)?.length).toBe(4)
    expect(html).toContain('Correction')
    expect(html.indexOf('We fixed a date')).toBeLessThan(html.indexOf('Work stops'))
    expect(html).toContain('<time dateTime="2024-01">January 2024</time>')
    expect(html).toContain('href="https://example.org/report"')
    expect(html).toContain('Reported by A reader in Kisumu')
  })

  it('is left out with nothing to show', () => {
    expect(renderToStaticMarkup(createElement(ClaimTimeline, { site, updates: [] }))).toBe('')
    expect(renderToStaticMarkup(createElement(LatestChanges, { site, changes: [] }))).toBe('')
  })
})
