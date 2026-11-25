import type { Actor, Claim, Figures, Rating, RatingScale, SiteInfo } from '@promisetracker/contract'
import { resolveStrings } from '@promisetracker/plugin-site'
import { describe, expect, it } from 'vitest'

import { absolute, alternates, jsonLd, publicOrigin } from '../../apps/site/src/seo'
import { addFigures, clip, tierFigures } from '../../apps/site/src/share'
import { actorData, claimReview } from '../../apps/site/src/structured'
import { escapeXml, robotsTxt, rss, sitemapIndex, urlset } from '../../apps/site/src/xml'

const ORIGIN = 'https://tracker.example.org'

const rating = (slug: string, tier: string, value: number): Rating => ({
  slug,
  label: slug,
  definition: null,
  tier,
  colour: '#00aa00',
  textColour: '#ffffff',
  value,
  needsDeadline: false,
  isStarting: false,
  retired: false,
})

const scale: RatingScale = {
  id: 'promise',
  name: 'Promises',
  bestValue: 5,
  worstValue: 1,
  tiers: [
    { slug: 'kept', label: 'Kept', colour: '#00aa00' },
    { slug: 'broken', label: 'Broken', colour: '#aa0000' },
  ],
  ratings: [rating('completed', 'kept', 5), rating('stalled', 'broken', 1)],
}

const site = {
  name: 'PromiseTracker',
  locale: 'fr',
  defaultLanguage: 'en',
  languages: [
    { code: 'en', label: 'English', rtl: false },
    { code: 'fr', label: 'Français', rtl: false },
  ],
  strings: resolveStrings('en', null),
  ratingScales: [scale],
} as SiteInfo

const claim = {
  slug: 'kibra-housing',
  title: 'Build 5,000 homes in Kibra',
  country: 'ke',
  actor: { slug: 'achieng-wekesa', name: 'Achieng Wekesa', kind: 'person' },
  rating: rating('completed', 'kept', 5),
  ratingScale: 'promise',
  saidOn: { value: '2023-02', precision: 'month' },
  statement: 'We will build 5,000 homes in Kibra.',
  sourceUrl: 'https://news.example.org/speech',
  ratedOn: '2025-01-10',
  lastReviewedAt: '2025-06-01',
  verification: { date: '2025-01-09', rationale: null, reportUrl: null },
} as Claim

describe('canonical addresses and hreflang', () => {
  it('names the page in this language, every other, and a default', () => {
    expect(alternates(site, '/ke/p/kibra-housing')).toEqual({
      canonical: '/fr/ke/p/kibra-housing',
      languages: {
        en: '/en/ke/p/kibra-housing',
        fr: '/fr/ke/p/kibra-housing',
        'x-default': '/en/ke/p/kibra-housing',
      },
    })
  })

  it('writes the home page without a trailing slash', () => {
    expect(alternates(site, '/').canonical).toBe('/fr')
  })

  it('takes the public address, or the local one when it is unset or not http(s)', () => {
    expect(publicOrigin({ PT_PUBLIC_URL: 'https://tracker.example.org/' })).toBe(ORIGIN)
    expect(publicOrigin({ PT_PUBLIC_URL: 'ftp://x', PORT: '4000' })).toBe('http://localhost:4000')
    expect(publicOrigin({})).toBe('http://localhost:3000')
    expect(absolute('/en', ORIGIN)).toBe(`${ORIGIN}/en`)
  })
})

describe('ClaimReview on a verified claim', () => {
  it('uses the rating’s value and its scale’s best and worst values', () => {
    const data = claimReview(site, claim, ORIGIN)
    expect(data).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ClaimReview',
      url: `${ORIGIN}/fr/ke/p/kibra-housing`,
      claimReviewed: claim.statement,
      datePublished: '2025-01-09',
      author: { '@type': 'Organization', name: 'PromiseTracker' },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: 5,
        bestRating: 5,
        worstRating: 1,
        alternateName: 'completed',
      },
      itemReviewed: {
        '@type': 'Claim',
        author: { '@type': 'Person', name: 'Achieng Wekesa' },
        datePublished: '2023-02',
        appearance: { url: 'https://news.example.org/speech' },
      },
    })
  })

  it('is left out of a claim with no rating', () => {
    expect(claimReview(site, { ...claim, rating: null }, ORIGIN)).toBeNull()
  })

  it('escapes the script so a value cannot close it', () => {
    expect(jsonLd({ name: '</script><b>' })).not.toContain('</script>')
  })
})

describe('actor data', () => {
  const actor = {
    slug: 'achieng-wekesa',
    name: 'Achieng Wekesa',
    kind: 'person',
    shortName: null,
    biography: 'Governor since 2022.',
    image: { url: '/media/achieng.jpg', alt: '', credit: null },
    party: { slug: 'unity', name: 'Unity Party', kind: 'party' },
    seats: [
      {
        office: { slug: 'governor', name: 'Governor', shortName: null },
        area: { slug: 'nairobi-county', name: 'Nairobi County', type: 'county' },
      },
    ],
    links: [{ type: 'website', url: 'https://wekesa.example.org' }],
  } as Actor

  it('describes a person with their seat and party', () => {
    expect(actorData(site, 'ke', actor, ORIGIN)).toMatchObject({
      '@type': 'Person',
      url: `${ORIGIN}/fr/ke/e/achieng-wekesa`,
      image: `${ORIGIN}/media/achieng.jpg`,
      jobTitle: 'Governor, Nairobi County',
      affiliation: { '@type': 'Organization', name: 'Unity Party' },
      sameAs: ['https://wekesa.example.org'],
    })
  })

  it('describes a party or an institution as an organization', () => {
    const party = { ...actor, kind: 'party' as const, seats: [], party: null }
    const data = actorData(site, 'ke', party, ORIGIN)
    expect(data['@type']).toBe('Organization')
    expect(data.jobTitle).toBeUndefined()
  })
})

describe('share images follow the counts rule', () => {
  const figures = (form: Figures['form'], kept: number, broken: number): Figures => ({
    total: kept + broken,
    form,
    byRating: { completed: kept, stalled: broken },
    byTier: { kept, broken },
  })

  it('writes counts below the threshold', () => {
    expect(tierFigures(site, figures('counts', 1, 2)).map((t) => t.text)).toEqual([
      '1 of 3',
      '2 of 3',
    ])
  })

  const percent = (n: number) =>
    new Intl.NumberFormat('fr', { style: 'percent', maximumFractionDigits: 0 }).format(n)

  it('writes percentages above it, in the page’s language', () => {
    expect(tierFigures(site, figures('percentages', 30, 10)).map((t) => t.text)).toEqual(
      [0.75, 0.25].map(percent),
    )
  })

  it('adds countries up, keeping percentages once any set reached the threshold', () => {
    const sum = addFigures([figures('counts', 1, 2), figures('percentages', 20, 5)])
    expect(sum).toMatchObject({ total: 28, form: 'percentages', byRating: { completed: 21 } })
    expect(addFigures([figures('counts', 1, 0), figures('counts', 0, 1)]).form).toBe('counts')
  })

  it('cuts long text at a word', () => {
    expect(clip('one two three four', 12)).toBe('one two…')
    expect(clip('short', 12)).toBe('short')
  })
})

describe('machine addresses', () => {
  it('lists child sitemaps', () => {
    expect(sitemapIndex([`${ORIGIN}/sitemap/en/ke.xml`])).toContain(
      `<sitemap><loc>${ORIGIN}/sitemap/en/ke.xml</loc></sitemap>`,
    )
  })

  it('gives each page its other languages', () => {
    const xml = urlset([{ loc: `${ORIGIN}/en/ke`, alternates: { fr: `${ORIGIN}/fr/ke` } }])
    expect(xml).toContain(`<loc>${ORIGIN}/en/ke</loc>`)
    expect(xml).toContain(`hreflang="fr" href="${ORIGIN}/fr/ke"`)
  })

  it('keeps a noindex server out of search engines', () => {
    expect(robotsTxt(`${ORIGIN}/sitemap.xml`, true)).toBe('User-agent: *\nDisallow: /\n')
    expect(robotsTxt(`${ORIGIN}/sitemap.xml`, false)).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
  })

  it('writes a feed with escaped text and RFC 822 dates', () => {
    const xml = rss({
      title: 'Kenya · PromiseTracker',
      link: `${ORIGIN}/en/ke`,
      self: `${ORIGIN}/en/ke/feed.xml`,
      description: 'Promises & progress',
      language: 'en',
      items: [
        { title: 'A <b>', link: `${ORIGIN}/en/ke/p/x`, description: null, date: '2025-06-01' },
      ],
    })
    expect(xml).toContain('<title>A &lt;b&gt;</title>')
    expect(xml).toContain('<pubDate>Sun, 01 Jun 2025 00:00:00 GMT</pubDate>')
    expect(escapeXml(`"'&`)).toBe('&quot;&apos;&amp;')
    expect(escapeXml('a\u0000b\u000Bc\td')).toBe('abc\td')
  })
})
