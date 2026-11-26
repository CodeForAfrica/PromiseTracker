import type {
  Area,
  Article,
  ArticleSummary,
  Claim,
  ClaimSummary,
  Figures,
  Page,
  RatingScale,
  SiteInfo,
  Theme,
} from '@promisetracker/contract'
import { pageSlugProblem } from '@promisetracker/plugin-core'
import { DEFAULT_STRINGS, resolveStrings, sectionField } from '@promisetracker/plugin-site'
import {
  ArticleView,
  CountryInFocus,
  CountryPicker,
  EditorPageView,
  FeaturedClaim,
  HowRatingsWork,
  InFocus,
  LatestAnalysis,
  Partners,
  pageHref,
  RichText,
  SisterTools,
  Snapshot,
  ThemeView,
  Tracked,
} from '@promisetracker/ui'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { htmlOf } from '../../apps/cms/src/api/v1'
import { richText } from '../../seed/seed'

/**
 * The editorial layer's parts that need no database (sections 7.7, 10.2 and
 * 11.2): each section renders what it is handed, the slug and interface-text
 * rules, and rich text made safe.
 */

const scale: RatingScale = {
  id: 'scale',
  name: 'Promises',
  bestValue: 5,
  worstValue: 0,
  tiers: [
    { slug: 'kept', label: 'Kept', colour: '#17694e' },
    { slug: 'not-kept', label: 'Not kept', colour: '#b42318' },
  ],
  ratings: [
    {
      slug: 'completed',
      label: 'Completed',
      definition: 'Done as promised.',
      tier: 'kept',
      colour: '#17694e',
      textColour: '#ffffff',
      value: 5,
      needsDeadline: false,
      isStarting: false,
      retired: false,
    },
    {
      slug: 'stalled',
      label: 'Stalled',
      definition: null,
      tier: 'not-kept',
      colour: '#b42318',
      textColour: '#ffffff',
      value: 1,
      needsDeadline: false,
      isStarting: true,
      retired: false,
    },
  ],
}

const site = (extra: Partial<SiteInfo> = {}): SiteInfo => ({
  name: 'PromiseTracker',
  locale: 'en',
  defaultLanguage: 'en',
  languages: [{ code: 'en', label: 'English', rtl: false }],
  description: null,
  explainer: null,
  strings: resolveStrings('en', null),
  navigation: [],
  footer: { about: null, links: [] },
  ratingScales: [scale],
  picks: { featuredClaim: null, inFocus: null, featuredArea: null },
  sections: {},
  partners: [],
  sisterTools: [],
  ...extra,
})

const html = (element: ReactElement | null) => (element ? renderToStaticMarkup(element) : '')

const summary: ClaimSummary = {
  slug: 'kibra-housing',
  title: 'Build 5000 homes in Kibra',
  country: 'ke',
  actor: { slug: 'achieng-wekesa', name: 'Achieng Wekesa', kind: 'person' },
  topic: { slug: 'housing', name: 'Housing', colour: null, parent: null },
  rating: scale.ratings[0] ?? null,
  ratingScale: 'scale',
  saidOn: null,
  deadline: null,
  deadlineText: null,
}

const figures = (form: Figures['form']): Figures => ({
  total: 4,
  form,
  byRating: { completed: 3, stalled: 1 },
  byTier: {},
})

const article = (extra: Partial<ArticleSummary> = {}): ArticleSummary => ({
  slug: 'why-late',
  country: 'ke',
  title: 'Why the homes are late',
  standfirst: 'The land was ready.',
  date: '2024-05-02',
  image: null,
  byline: null,
  about: { kind: 'claim', slug: 'kibra-housing', name: 'Build 5000 homes in Kibra' },
  ...extra,
})

describe('homepage sections', () => {
  it('shows a real claim with its rating, review date and evidence', () => {
    const claim = {
      ...summary,
      summary: 'A flagship pledge.',
      lastReviewedAt: '2024-06-01',
      evidence: [
        {
          id: 'e1',
          kind: 'article',
          title: 'Budget',
          publisher: 'Treasury',
          date: null,
          url: null,
          finding: null,
          thumbnail: null,
        },
        {
          id: 'e2',
          kind: 'document',
          title: 'Report',
          publisher: null,
          date: null,
          url: null,
          finding: null,
          thumbnail: null,
        },
      ],
    } as unknown as Claim
    const out = html(FeaturedClaim({ site: site(), claim }))
    expect(out).toContain('A real claim')
    expect(out).toContain('Completed')
    expect(out).toMatch(/2 sources · Last reviewed .*2024/)
    expect(out).toContain('Treasury')
    const bare = html(
      FeaturedClaim({
        site: site(),
        claim: {
          ...claim,
          summary: null,
          lastReviewedAt: null,
          evidence: [],
          rating: null,
        } as Claim,
      }),
    )
    expect(bare).not.toContain('Where the evidence comes from')
  })

  it('names a theme across countries, or within one, with the featured place', () => {
    const theme = (codes: string[]): Theme => ({
      slug: 'water',
      title: 'Water',
      introduction: null,
      image: null,
      countries: codes.map((code) => ({ code, name: code.toUpperCase(), region: null })),
      claims: [summary],
      figures: [],
    })
    const area = {
      slug: 'nairobi-county',
      name: 'Nairobi County',
      seats: [{ holders: [{}, {}] }, { holders: [{}] }],
    } as unknown as Area
    const across = html(
      InFocus({ site: site(), theme: theme(['ke', 'sn']), place: { country: 'ke', area } }),
    )
    expect(across).toContain('Water, across 2 countries')
    expect(across).toContain('3 officials answer for it')
    const within = html(InFocus({ site: site(), theme: theme(['ke']), place: null }))
    expect(within).toContain('Water, in KE')
    expect(within).not.toContain('answer for it')
  })

  it('explains the ratings by tier, linking to the methodology when there is one', () => {
    expect(html(HowRatingsWork({ site: site(), methodology: '/en/methodology' }))).toContain(
      'href="/en/methodology"',
    )
    const without = html(HowRatingsWork({ site: site(), methodology: null }))
    expect(without).not.toContain('Read the full methodology')
    expect(without).toContain('Done as promised.')
    expect(html(HowRatingsWork({ site: site({ ratingScales: [] }), methodology: null }))).toBe('')
  })

  it('shows what we have tracked, with a bar only above the counts threshold', () => {
    const overview = (form: Figures['form'], sources: number) => ({
      figures: figures(form),
      actors: 2,
      countries: 1,
      sources,
    })
    const big = html(Tracked({ site: site(), overview: overview('percentages', 7) }))
    expect(big).toContain('cited sources')
    const small = html(Tracked({ site: site(), overview: overview('counts', 0) }))
    expect(small).not.toContain('cited sources')
    expect(small).toContain('3 of 4')
  })

  it('lists partners by logo or name, and marks sister tools as leaving the site', () => {
    const partners = html(
      Partners({
        site: site(),
        partners: [
          { name: 'Code for Africa', url: 'https://codeforafrica.org', logo: null, countries: [] },
          {
            name: 'Logo Org',
            url: 'https://example.org',
            logo: { url: '/l.png', alt: '' },
            countries: [],
          },
        ],
      }),
    )
    expect(partners).toContain('Code for Africa')
    expect(partners).toContain('alt="Logo Org"')
    const tools = html(
      SisterTools({
        site: site(),
        tools: [
          { name: 'PesaCheck', url: 'https://pesacheck.org', description: 'Fact-checks.' },
          { name: 'Other', url: 'https://example.org', description: null },
        ],
      }),
    )
    expect(tools).toContain('Opens another site')
    expect(tools).toContain('Fact-checks.')
  })

  it('lists countries as a link or as a list', () => {
    const countries = [{ code: 'ke', name: 'Kenya', region: null }]
    expect(html(CountryPicker({ site: site(), countries }))).not.toContain('Choose a country')
    expect(html(CountryPicker({ site: site(), countries, asList: true }))).toContain(
      'Choose a country',
    )
    expect(html(CountryPicker({ site: site(), countries: [] }))).toBe('')
  })
})

describe('country, claim and actor sections', () => {
  it("shows a country's picks and its snapshot", () => {
    const picks = html(CountryInFocus({ site: site(), code: 'ke', actors: [], claims: [summary] }))
    expect(picks).toContain('Build 5000 homes in Kibra')
    expect(html(Snapshot({ site: site(), figures: figures('counts') }))).toContain('Snapshot')
  })

  it('lists the latest analysis, with a byline only when there is one', () => {
    const out = html(
      LatestAnalysis({
        site: site(),
        articles: [
          article({ byline: 'A. Reporter', image: { url: '/a.jpg', alt: '', credit: null } }),
          article({ slug: 'second', standfirst: null }),
        ],
      }),
    )
    expect(out).toContain('By A. Reporter')
    expect(out).toContain('href="/en/ke/a/why-late"')
  })
})

describe('articles, themes and editor pages', () => {
  it('shows an article about a claim, an actor or a country', () => {
    const full: Article = {
      ...article({
        image: { url: '/a.jpg', alt: 'Site', credit: 'Photo: PT' },
        byline: 'A. Reporter',
      }),
      body: '<p>Body.</p>',
    }
    const claimArticle = html(ArticleView({ site: site(), article: full }))
    expect(claimArticle).toContain('href="/en/ke/p/kibra-housing"')
    expect(claimArticle).toContain('Photo: PT')
    const actor = html(
      ArticleView({
        site: site(),
        article: {
          ...full,
          image: null,
          body: null,
          about: { kind: 'actor', slug: 'achieng-wekesa', name: 'A' },
        },
      }),
    )
    expect(actor).toContain('href="/en/ke/e/achieng-wekesa"')
    const country = html(
      ArticleView({
        site: site(),
        article: { ...full, about: { kind: 'country', slug: 'ke', name: 'Kenya' } },
      }),
    )
    expect(country).toContain('href="/en/ke"')
  })

  it('shows a theme with figures by country, or says it has no claims', () => {
    const base: Theme = {
      slug: 'water',
      title: 'Water',
      introduction: 'Pipes and wells.',
      image: null,
      countries: [],
      claims: [],
      figures: [],
    }
    expect(html(ThemeView({ site: site(), theme: base }))).toContain('No claims')
    const full = html(
      ThemeView({
        site: site(),
        theme: {
          ...base,
          introduction: null,
          claims: [summary],
          figures: [
            { country: { code: 'ke', name: 'Kenya', region: null }, figures: figures('counts') },
          ],
        },
      }),
    )
    expect(full).toContain('href="/en/ke"')
  })

  it('shows where an editor page sits, and marks pages that lead elsewhere', () => {
    const page: Page = {
      title: 'Guides',
      path: 'resources/guides',
      summary: 'How to.',
      link: null,
      body: '<p>Text.</p>',
      parents: [{ title: 'Resources', path: 'resources', summary: null, link: null }],
      children: [
        { title: 'Check', path: 'resources/guides/check', summary: 'Ours.', link: null },
        {
          title: 'PesaCheck',
          path: 'resources/guides/pesacheck',
          summary: null,
          link: 'https://pesacheck.org',
        },
      ],
    }
    const out = html(EditorPageView({ site: site(), page }))
    expect(out).toContain('href="/en/resources"')
    expect(out).toContain('href="https://pesacheck.org"')
    expect(out).toContain('Opens another site')
    const plain = html(
      EditorPageView({
        site: site(),
        page: { ...page, summary: null, body: null, parents: [], children: [] },
      }),
    )
    expect(plain).not.toContain('In this section')
    expect(pageHref('fr', { path: 'about', link: null })).toBe('/fr/about')
    expect(html(RichText({ html: '<p>x</p>' }))).toContain('<p>x</p>')
  })
})

describe('rules', () => {
  it('refuses an editor page slug a country or the site itself uses (section 11.2)', () => {
    expect(pageSlugProblem('ke')).toMatch(/two-letter/)
    expect(pageSlugProblem('topics')).toMatch(/site's own/)
    expect(pageSlugProblem('officials')).toMatch(/site's own/)
    expect(pageSlugProblem('Bad Slug')).toMatch(/lower-case/)
    expect(pageSlugProblem('')).toMatch(/Give it a slug/)
    expect(pageSlugProblem('about')).toBeNull()
  })

  it('names section settings in camelCase, and fills interface text an editor left empty', () => {
    expect(sectionField('home.in-focus')).toBe('homeInFocus')
    expect(resolveStrings('en', 'not an object').inFocus).toBe(DEFAULT_STRINGS.en.inFocus)
    expect(resolveStrings('fr', { inFocus: '  ', latestAnalysis: 'Analyses' }).inFocus).toBe(
      DEFAULT_STRINGS.fr.inFocus,
    )
    expect(resolveStrings('fr', { latestAnalysis: 'Analyses' }).latestAnalysis).toBe('Analyses')
    expect(resolveStrings('fr', [1, 2]).inFocus).toBe(DEFAULT_STRINGS.fr.inFocus)
  })

  it('turns rich text into HTML, and drops unsafe link addresses', () => {
    const out = htmlOf(
      richText([
        { h2: 'Heading' },
        { p: 'Text' },
        { link: { text: 'Safe', url: 'https://example.org' } },
        { link: { text: 'Mail', url: 'mailto:a@example.org' } },
        { link: { text: 'Here', url: '/en/methodology' } },
        { link: { text: 'Bad', url: 'javascript:alert(1)' } },
      ]),
    )
    expect(out).toContain('<h2>Heading</h2>')
    expect(out).toContain('href="https://example.org"')
    expect(out).toContain('href="mailto:a@example.org"')
    expect(out).toContain('href="/en/methodology"')
    expect(out).not.toContain('javascript:')
    expect(htmlOf(null)).toBeNull()
    expect(htmlOf({ nothing: true })).toBeNull()
    expect(htmlOf(richText([]))).toBeNull()
  })
})
