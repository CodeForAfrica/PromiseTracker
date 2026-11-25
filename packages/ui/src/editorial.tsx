import type {
  ActorSummary,
  Area,
  Article,
  ArticleSummary,
  Claim,
  ClaimSummary,
  Figures,
  Overview,
  Page,
  PageSummary,
  Partner,
  SisterTool,
  SiteInfo,
  Theme,
} from '@promisetracker/contract'
import Link from 'next/link'

import { ActorGrid, actorPath, CountrySection } from './actors'
import { Container } from './Container'
import { ClaimList, CountryFigures, FiguresBlock } from './claims'
import { fill } from './fill'
import { claimPath, localePath } from './paths'
import { orderedRatings, RatingChip, TierBar } from './ratings'
import { SectionLabel } from './Text'

/**
 * The editorial layer (sections 7.7 and 10.2): the homepage sections editors
 * choose, themes, articles and editor pages. Each component is handed only
 * what it shows, and whether it shows is decided by the page with the rules
 * in `sections.ts`.
 */

/** A theme's page: `/{lang}/themes/{theme}`. */
export const themePath = (locale: string, slug: string): string =>
  localePath(locale, `/themes/${slug}`)

/** An article's page: `/{lang}/{cc}/a/{article}`. */
export const articlePath = (locale: string, code: string, slug: string): string =>
  localePath(locale, `/${code}/a/${slug}`)

/** An editor page: `/{lang}/{page}`, or the sister site it leads to. */
export const pageHref = (locale: string, page: Pick<PageSummary, 'path' | 'link'>): string =>
  page.link ?? localePath(locale, `/${page.path}`)

const longDate = (locale: string, day: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

const number = (locale: string, n: number): string => new Intl.NumberFormat(locale).format(n)

/**
 * Text an editor wrote, as the API sends it: HTML made from the rich-text
 * editor's structured content, never from markup anyone typed.
 */
export function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={[
        'max-w-[68ch] text-[17px] leading-[1.7] text-ink-2',
        '[&_a]:underline [&_a]:underline-offset-2',
        '[&_blockquote]:border-s-2 [&_blockquote]:border-line [&_blockquote]:ps-4',
        '[&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-[24px] [&_h2]:leading-[1.25] [&_h2]:font-semibold [&_h2]:text-ink',
        '[&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:text-ink',
        '[&_li]:mb-1.5 [&_ol]:mb-5 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:mb-5 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:ps-6',
        className ?? '',
      ].join(' ')}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the API makes it from structured content, and checks link addresses
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Homepage

/** "A real claim": the editor's pick, with its rating and where its evidence comes from. */
export function FeaturedClaim({ site, claim }: { site: SiteInfo; claim: Claim }) {
  const t = site.strings
  const href = claimPath(site.locale, claim.country, claim.slug)
  const evidence = claim.evidence.slice(0, 4)
  return (
    <section aria-labelledby="featured-claim" className="bg-surface">
      <Container className="pt-7 pb-8">
        <SectionLabel id="featured-claim">{t.realClaim}</SectionLabel>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-3.5 flex flex-wrap items-center gap-[9px]">
              {claim.rating && <RatingChip rating={claim.rating} />}
              <span className="text-[11px] leading-normal tracking-[.06em] text-muted uppercase">
                {[claim.topic?.name, claim.actor.name].filter(Boolean).join(' · ')}
              </span>
            </div>
            <h3 className="mb-4 text-[28px] leading-[1.1] font-semibold tracking-[-.025em] sm:text-[32px]">
              <Link href={href} className="text-ink hover:text-ink hover:opacity-70">
                {claim.title}
              </Link>
            </h3>
            {claim.summary && (
              <p className="mb-[22px] max-w-[60ch] text-[15px] leading-[1.65] text-ink-2">
                {claim.summary}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-[22px]">
              <Link
                href={href}
                className="rounded-lg bg-ink px-5 py-3.5 text-[12px] leading-none font-medium tracking-[.06em] text-white uppercase hover:text-white hover:opacity-80"
              >
                {t.seeRecord}
              </Link>
              {claim.lastReviewedAt && (
                <span className="text-[11px] leading-[1.6] tracking-[.05em] text-muted uppercase">
                  {fill(t.sourcesReviewed, {
                    n: String(claim.evidence.length),
                    date: longDate(site.locale, claim.lastReviewedAt),
                  })}
                </span>
              )}
            </div>
          </div>
          {evidence.length > 0 && (
            <aside className="rounded-lg bg-white p-[22px]">
              <p className="text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
                {t.evidenceFrom}
              </p>
              <ul className="mt-2 grid gap-4">
                {evidence.map((e) => (
                  <li key={e.id}>
                    <p className="text-[13px] leading-[1.45] font-medium">{e.title}</p>
                    {e.publisher && (
                      <p className="mt-0.5 text-[11px] tracking-[.04em] text-muted uppercase">
                        {e.publisher}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </Container>
    </section>
  )
}

/**
 * In focus: the editor's theme, a few of its claims, and the place they
 * picked with who answers for it.
 */
export function InFocus({
  site,
  theme,
  place,
}: {
  site: SiteInfo
  theme: Theme
  place: { country: string; area: Area } | null
}) {
  const t = site.strings
  const href = themePath(site.locale, theme.slug)
  const [only] = theme.countries
  const heading =
    theme.countries.length === 1 && only
      ? fill(t.withinCountry, { theme: theme.title, country: only.name })
      : fill(t.acrossCountries, { theme: theme.title, n: String(theme.countries.length) })
  const holders = place ? place.area.seats.reduce((n, seat) => n + seat.holders.length, 0) : 0
  return (
    <section aria-labelledby="in-focus">
      <Container className="pt-9 pb-10">
        <div className="mb-8 flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <h2
            id="in-focus"
            className="text-[32px] leading-[1.1] font-semibold tracking-[-.025em] sm:text-[40px]"
          >
            {t.inFocus}
          </h2>
          <span className="text-[14px] text-muted">{t.chosenByEditor}</span>
        </div>
        <SectionLabel as="h3">{t.themeLabel}</SectionLabel>
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
          <h3 className="text-[24px] leading-[1.25] font-semibold tracking-[-.015em]">
            <Link href={href} className="text-ink hover:text-ink hover:opacity-70">
              {heading}
            </Link>
          </h3>
          <Link href={href} className="text-[14px] font-medium">
            {fill(t.allOnTheme, { n: String(theme.claims.length) })}
          </Link>
        </div>
        <ClaimList site={site} claims={theme.claims.slice(0, 4)} />
        {place && holders > 0 && (
          <div className="mt-10">
            <SectionLabel as="h3">{t.featuredPlace}</SectionLabel>
            <Link
              href={localePath(site.locale, `/${place.country}/${place.area.slug}`)}
              className="inline-flex flex-col rounded-lg bg-surface px-[22px] py-5 text-ink hover:text-ink hover:opacity-80"
            >
              <span className="text-[20px] font-semibold">{place.area.name}</span>
              <span className="mt-1 text-[14px] text-ink-2">
                {fill(t.answeredBy, { n: String(holders) })}
              </span>
            </Link>
          </div>
        )}
      </Container>
    </section>
  )
}

/**
 * How a rating is decided: every rating on the site's first scale, by tier,
 * with its definition, and a link to the methodology.
 */
export function HowRatingsWork({
  site,
  methodology,
}: {
  site: SiteInfo
  methodology: string | null
}) {
  const t = site.strings
  const [scale] = site.ratingScales
  if (!scale) return null
  const ratings = orderedRatings(scale).filter((r) => !r.retired)
  return (
    <section aria-labelledby="how-ratings-work" className="bg-ink text-white">
      <Container className="pt-9 pb-10">
        <SectionLabel id="how-ratings-work" className="text-white">
          {t.howRatingDecided}
        </SectionLabel>
        <div className="max-w-[640px]">
          <h3 className="mb-3.5 text-[30px] leading-[1.12] font-semibold tracking-[-.02em] sm:text-[36px]">
            {t.howRatingTitle}
          </h3>
          <p className="mb-[18px] text-[15px] leading-[1.65] text-[#c9ccd2]">{t.howRatingBody}</p>
          {methodology && (
            <Link
              href={methodology}
              className="text-white underline underline-offset-[3px] hover:text-white hover:opacity-80"
            >
              {t.readMethodology}
            </Link>
          )}
        </div>
        <div className="mt-9 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-x-8 gap-y-7">
          {scale.tiers.map((tier) => (
            <div key={tier.slug}>
              <p className="border-b border-white/30 pb-3 text-[17px] font-semibold">
                {tier.label}
              </p>
              {ratings
                .filter((r) => r.tier === tier.slug)
                .map((r) => (
                  <div key={r.slug} className="py-4">
                    <div className="flex items-center gap-2.5 text-[14px] font-medium">
                      <i
                        aria-hidden="true"
                        className="block size-2.5 flex-none rounded-[3px]"
                        style={{ background: r.colour }}
                      />
                      {r.label}
                    </div>
                    {r.definition && (
                      <p className="ms-5 mt-2 text-[13px] leading-[1.6] text-[#c9ccd2]">
                        {r.definition}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

/** What we have tracked: how many claims, people and sources, and how they are rated. */
export function Tracked({ site, overview }: { site: SiteInfo; overview: Overview }) {
  const t = site.strings
  const [scale] = site.ratingScales
  return (
    <section aria-labelledby="tracked">
      <Container className="pt-9 pb-10">
        <SectionLabel id="tracked">{t.whatTracked}</SectionLabel>
        <div className="flex flex-wrap items-end gap-x-14 gap-y-6">
          <p className="flex items-baseline gap-3.5">
            <span className="text-[64px] leading-[.9] font-semibold tracking-[-.035em] sm:text-[88px]">
              {number(site.locale, overview.figures.total)}
            </span>
            <span className="text-[11.5px] tracking-[.06em] text-muted uppercase">
              {t.trackedClaims}
            </span>
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-2">
            <span>
              <b className="font-semibold text-ink">{number(site.locale, overview.actors)}</b>{' '}
              {t.trackedActors}
            </span>
            <span>
              <b className="font-semibold text-ink">{number(site.locale, overview.countries)}</b>{' '}
              {t.trackedCountries}
            </span>
            {overview.sources > 0 && (
              <span>
                <b className="font-semibold text-ink">{number(site.locale, overview.sources)}</b>{' '}
                {t.trackedSources}
              </span>
            )}
          </p>
        </div>
        {scale && overview.figures.form === 'percentages' && (
          <TierBar
            scale={scale}
            counts={overview.figures.byRating}
            className="mt-9 h-6 gap-1 rounded-md"
          />
        )}
        <div className="mt-8">
          <FiguresBlock site={site} figures={overview.figures} />
        </div>
      </Container>
    </section>
  )
}

/** Who we work with. */
export function Partners({ site, partners }: { site: SiteInfo; partners: readonly Partner[] }) {
  return (
    <CountrySection id="partners" title={site.strings.whoWeWorkWith}>
      <ul className="flex flex-wrap items-center gap-x-10 gap-y-6">
        {partners.map((p) => (
          <li key={p.url}>
            <a
              href={p.url}
              rel="noopener"
              className="flex items-center gap-3 text-ink hover:text-ink hover:opacity-70"
            >
              {p.logo ? (
                // biome-ignore lint/performance/noImgElement: logos are small, and their sizes vary
                <img
                  src={p.logo.url}
                  alt={p.logo.alt || p.name}
                  className="h-10 w-auto"
                  loading="lazy"
                />
              ) : (
                <span className="text-[17px] font-semibold">{p.name}</span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </CountrySection>
  )
}

/** Other tools from PesaCheck. Each leaves the site, and says so. */
export function SisterTools({ site, tools }: { site: SiteInfo; tools: readonly SisterTool[] }) {
  return (
    <CountrySection id="sister-tools" title={site.strings.otherTools}>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6">
        {tools.map((tool) => (
          <li key={tool.url}>
            <a href={tool.url} rel="noopener" className="group block text-ink hover:text-ink">
              <span className="text-[17px] font-semibold group-hover:opacity-70">
                {tool.name}
                <span aria-hidden="true"> ↗</span>
                <span className="sr-only"> ({site.strings.leavesSite})</span>
              </span>
              {tool.description && (
                <span className="mt-1 block text-[14px] leading-[1.6] text-ink-2">
                  {tool.description}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </CountrySection>
  )
}

// Country page

/** In focus on a country page: the actors and claims an editor picked. */
export function CountryInFocus({
  site,
  code,
  actors,
  claims,
}: {
  site: SiteInfo
  code: string
  actors: readonly ActorSummary[]
  claims: readonly ClaimSummary[]
}) {
  const t = site.strings
  return (
    <CountrySection id="country-in-focus" title={t.inFocus}>
      <div className="grid gap-8">
        {actors.length > 0 && <ActorGrid site={site} code={code} actors={[...actors]} />}
        {claims.length > 0 && <ClaimList site={site} claims={claims} />}
      </div>
    </CountrySection>
  )
}

/** The country snapshot: the figures of every published claim in it. */
export function Snapshot({ site, figures }: { site: SiteInfo; figures: Figures }) {
  return (
    <CountrySection id="snapshot" title={site.strings.countrySnapshot}>
      <FiguresBlock site={site} figures={figures} />
    </CountrySection>
  )
}

// Articles

function ArticleMeta({ site, article }: { site: SiteInfo; article: ArticleSummary }) {
  return (
    <p className="text-[11px] tracking-[.05em] text-muted uppercase">
      {[
        longDate(site.locale, article.date),
        article.byline ? fill(site.strings.byline, { name: article.byline }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    </p>
  )
}

/** Latest analysis: the newest articles about an actor or a claim (section 10.2). */
export function LatestAnalysis({
  site,
  articles,
}: {
  site: SiteInfo
  articles: readonly ArticleSummary[]
}) {
  return (
    <CountrySection id="latest-analysis" title={site.strings.latestAnalysis}>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-x-12 gap-y-8">
        {articles.map((a) => (
          <li key={a.slug} className="grid items-start gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
            {a.image ? (
              // biome-ignore lint/performance/noImgElement: editors' images come from the media store at many sizes
              <img
                src={a.image.url}
                alt=""
                className="aspect-[3/2] w-full rounded-lg object-cover"
                loading="lazy"
              />
            ) : null}
            <div className={a.image ? '' : 'sm:col-span-2'}>
              <h3 className="mb-2 text-[19px] leading-[1.3] font-semibold tracking-[-.01em]">
                <Link
                  href={articlePath(site.locale, a.country, a.slug)}
                  className="text-ink hover:text-ink hover:opacity-70"
                >
                  {a.title}
                </Link>
              </h3>
              {a.standfirst && (
                <p className="mb-3 text-[14px] leading-[1.6] text-ink-2">{a.standfirst}</p>
              )}
              <ArticleMeta site={site} article={a} />
            </div>
          </li>
        ))}
      </ul>
    </CountrySection>
  )
}

const aboutPath = (locale: string, article: ArticleSummary): string => {
  const { kind, slug } = article.about
  if (kind === 'claim') return claimPath(locale, article.country, slug)
  if (kind === 'actor') return actorPath(locale, article.country, slug)
  return localePath(locale, `/${article.country}`)
}

/** An article's page. */
export function ArticleView({ site, article }: { site: SiteInfo; article: Article }) {
  return (
    <article>
      <Container className="pt-12 pb-12">
        <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
          <Link href={aboutPath(site.locale, article)} className="text-muted hover:text-ink">
            {fill(site.strings.aboutLabel, { name: article.about.name })}
          </Link>
        </p>
        <h1 className="max-w-[24ch] text-[36px] leading-[1.1] font-semibold tracking-[-.02em] sm:text-[48px]">
          {article.title}
        </h1>
        {article.standfirst && (
          <p className="mt-4 max-w-[60ch] text-[19px] leading-[1.55] text-ink-2">
            {article.standfirst}
          </p>
        )}
        <div className="mt-5">
          <ArticleMeta site={site} article={article} />
        </div>
        {article.image && (
          <figure className="mt-8 max-w-[860px]">
            {/* biome-ignore lint/performance/noImgElement: editors' images come from the media store at many sizes */}
            <img src={article.image.url} alt={article.image.alt} className="w-full rounded-lg" />
            {article.image.credit && (
              <figcaption className="mt-2 text-[12px] text-muted">
                {article.image.credit}
              </figcaption>
            )}
          </figure>
        )}
        {article.body && <RichText html={article.body} className="mt-10" />}
      </Container>
    </article>
  )
}

// Themes

/** A theme's page: its introduction, figures by country, and its claims. */
export function ThemeView({ site, theme }: { site: SiteInfo; theme: Theme }) {
  const t = site.strings
  return (
    <>
      <section className="border-b border-line-soft">
        <Container className="pt-12 pb-10">
          <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
            {t.themeLabel}
          </p>
          <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-.02em] sm:text-[48px]">
            {theme.title}
          </h1>
          {theme.introduction && (
            <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.6] text-ink-2">
              {theme.introduction}
            </p>
          )}
        </Container>
      </section>
      {theme.figures.length > 0 && (
        <CountrySection id="by-country" title={t.figuresByCountry}>
          <CountryFigures
            site={site}
            countries={theme.figures}
            href={(code) => localePath(site.locale, `/${code}`)}
          />
        </CountrySection>
      )}
      <CountrySection id="claims" title={t.themeClaims}>
        {theme.claims.length === 0 ? (
          <p className="text-[15px] text-ink-2">{t.noClaims}</p>
        ) : (
          <ClaimList site={site} claims={theme.claims} />
        )}
      </CountrySection>
    </>
  )
}

// Editor pages

/** An editor page: where it sits, its text, and the pages under it. */
export function EditorPageView({ site, page }: { site: SiteInfo; page: Page }) {
  return (
    <article>
      <Container className="pt-12 pb-12">
        {page.parents.length > 0 && (
          <nav aria-label={site.strings.breadcrumb} className="mb-4">
            <ol className="flex flex-wrap gap-2 text-[13px] text-muted">
              {page.parents.map((p) => (
                <li key={p.path} className="after:ms-2 after:content-['/']">
                  <Link href={pageHref(site.locale, p)} className="text-muted hover:text-ink">
                    {p.title}
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="max-w-[24ch] text-[36px] leading-[1.1] font-semibold tracking-[-.02em] sm:text-[48px]">
          {page.title}
        </h1>
        {page.summary && (
          <p className="mt-4 max-w-[60ch] text-[19px] leading-[1.55] text-ink-2">{page.summary}</p>
        )}
        {page.body && <RichText html={page.body} className="mt-10" />}
        {page.children.length > 0 && (
          <section aria-labelledby="pages-below" className="mt-12">
            <SectionLabel id="pages-below" rule>
              {site.strings.pagesBelow}
            </SectionLabel>
            <ul className="grid gap-5">
              {page.children.map((child) => (
                <li key={child.path}>
                  <Link
                    href={pageHref(site.locale, child)}
                    className="text-[17px] font-semibold text-ink hover:text-ink hover:opacity-70"
                  >
                    {child.title}
                    {child.link && (
                      <>
                        <span aria-hidden="true"> ↗</span>
                        <span className="sr-only"> ({site.strings.leavesSite})</span>
                      </>
                    )}
                  </Link>
                  {child.summary && <p className="mt-1 text-[14px] text-ink-2">{child.summary}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>
    </article>
  )
}
