import type {
  Claim,
  ClaimSummary,
  Figures,
  PartialDate,
  RatingScale,
  SiteInfo,
  TopicSummary,
} from '@promisetracker/contract'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { actorPath, CountrySection, seatLabel } from './actors'
import { Container } from './Container'
import { fill } from './fill'
import { localePath } from './paths'
import { RatingChip, RatingLegend, TierBar } from './ratings'

/** A claim's page: `/{lang}/{cc}/p/{claim}` (section 11.1). */
export const claimPath = (locale: string, code: string, slug: string): string =>
  localePath(locale, `/${code}/p/${slug}`)

/** A topic's page: `/{lang}/topics/{topic}`. */
export const topicPath = (locale: string, slug: string): string =>
  localePath(locale, `/topics/${slug}`)

/** "2027", "August 2027" or "9 August 2027", as precise as the date is. */
export function formatPartialDate(locale: string, date: PartialDate): string {
  const when = new Date(`${date.value.padEnd(10, '-01').slice(0, 10)}T00:00:00Z`)
  const parts: Intl.DateTimeFormatOptions =
    date.precision === 'year'
      ? { year: 'numeric' }
      : date.precision === 'month'
        ? { year: 'numeric', month: 'long' }
        : { year: 'numeric', month: 'long', day: 'numeric' }
  return new Intl.DateTimeFormat(locale, { ...parts, timeZone: 'UTC' }).format(when)
}

/**
 * How one figure is written: "1 of 3" below the threshold, "33%" above it
 * (section 10.4). The API says which.
 */
export function figureFormat(site: SiteInfo, figures: Figures): (count: number) => string {
  if (figures.form === 'counts') {
    return (count) =>
      fill(site.strings.figureOf, { count: String(count), total: String(figures.total) })
  }
  return (count) =>
    new Intl.NumberFormat(site.locale, { style: 'percent', maximumFractionDigits: 0 }).format(
      figures.total === 0 ? 0 : count / figures.total,
    )
}

/**
 * The figures split by scale: each scale with claims on it, with its own
 * counts and total. Claims on different scales are never drawn on one bar.
 */
export function scalesOf(
  site: SiteInfo,
  figures: Figures,
): { scale: RatingScale; figures: Figures }[] {
  return site.ratingScales.flatMap((scale) => {
    const byRating: Record<string, number> = {}
    for (const rating of scale.ratings) {
      const count = figures.byRating[rating.slug]
      if (count) byRating[rating.slug] = count
    }
    const total = Object.values(byRating).reduce((sum, n) => sum + n, 0)
    // Each scale keeps the form the API chose for the whole set (section 10.4).
    return total > 0 ? [{ scale, figures: { ...figures, total, byRating, byTier: {} } }] : []
  })
}

/**
 * A set of figures as a tier bar and a legend for each scale its claims are
 * rated on, written as the API says. The scale is named when there are several.
 */
export function FiguresBlock({ site, figures }: { site: SiteInfo; figures: Figures }) {
  const parts = scalesOf(site, figures)
  if (parts.length === 0) return null
  return (
    <div className="grid gap-8">
      {parts.map(({ scale, figures: part }) => (
        <div key={scale.id} className="grid gap-4">
          {parts.length > 1 && <p className="text-[13px] font-semibold text-ink">{scale.name}</p>}
          <TierBar scale={scale} counts={part.byRating} className="h-3 gap-0.5 rounded-full" />
          <RatingLegend
            scale={scale}
            counts={part.byRating}
            hideEmpty
            leader
            format={figureFormat(site, part)}
            className="max-w-md"
          />
        </div>
      ))}
    </div>
  )
}

/** A claim's rating, looked up in the site's scales. */
function ClaimRating({ claim }: { claim: ClaimSummary }) {
  return claim.rating ? <RatingChip rating={claim.rating} /> : null
}

/** Claims as a list, each with its rating, who made it and when it is due. */
export function ClaimList({
  site,
  claims,
  showActor = true,
}: {
  site: SiteInfo
  claims: readonly ClaimSummary[]
  showActor?: boolean
}) {
  const t = site.strings
  return (
    <ul className="divide-y divide-line-soft border-y border-line-soft">
      {claims.map((claim) => (
        <li key={`${claim.country}-${claim.slug}`} className="flex flex-col gap-2 py-4">
          <div>
            <ClaimRating claim={claim} />
          </div>
          <Link
            href={claimPath(site.locale, claim.country, claim.slug)}
            className="text-[17px] leading-[1.3] font-semibold text-ink hover:text-ink hover:opacity-80"
          >
            {claim.title}
          </Link>
          <p className="text-[13px] leading-normal text-ink-2">
            {[
              showActor ? claim.actor.name : null,
              claim.topic?.name,
              claim.deadline
                ? `${t.claimByWhen}: ${formatPartialDate(site.locale, claim.deadline)}`
                : claim.deadlineText
                  ? `${t.claimByWhen}: ${claim.deadlineText}`
                  : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </li>
      ))}
    </ul>
  )
}

type Choice = { value: string; label: string }

/** Filters for a claim list. A plain form, so the filters live in the address. */
export function ClaimFilters({
  site,
  fields,
  selected,
}: {
  site: SiteInfo
  fields: readonly { name: string; label: string; choices: readonly Choice[] }[]
  selected: Readonly<Record<string, string>>
}) {
  const control = 'min-h-11 rounded border border-line bg-white px-3 text-[14px] text-ink'
  return (
    <form method="get" className="mb-6 flex flex-wrap items-end gap-4">
      {fields
        .filter((field) => field.choices.length > 0)
        .map((field) => (
          <div key={field.name} className="flex flex-col gap-1 text-[12px] font-medium text-ink-2">
            <label htmlFor={`filter-${field.name}`}>{field.label}</label>
            <select
              id={`filter-${field.name}`}
              name={field.name}
              defaultValue={selected[field.name] ?? ''}
              className={control}
            >
              <option value="">{site.strings.filterAll}</option>
              {field.choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      <button
        type="submit"
        className="min-h-11 rounded-full bg-ink px-5 text-[14px] font-medium text-white"
      >
        {site.strings.showResults}
      </button>
    </form>
  )
}

/** The ratings of the site's scales, as filter choices. Retired ratings are left out. */
export const ratingChoices = (site: SiteInfo): Choice[] =>
  site.ratingScales.flatMap((scale) =>
    scale.ratings.filter((r) => !r.retired).map((r) => ({ value: r.slug, label: r.label })),
  )

export const topicChoices = (topics: readonly TopicSummary[]): Choice[] =>
  topics.map((topic) => ({
    value: topic.slug,
    label: topic.parent ? `${topic.parent.name} › ${topic.name}` : topic.name,
  }))

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-[15px] leading-normal text-ink">{children}</dd>
    </div>
  )
}

/**
 * The claim page's sections that have data (section 10.2): the claim, with
 * who, where, when and by when, and its rating. Evidence, the rating history
 * and the analysis join it with their issues.
 */
export function ClaimView({ site, claim }: { site: SiteInfo; claim: Claim }) {
  const t = site.strings
  const where = claim.area?.name ?? (claim.seat ? seatLabel(claim.seat) : null)
  const when = [claim.saidOn ? formatPartialDate(site.locale, claim.saidOn) : null, claim.saidAt]
    .filter(Boolean)
    .join(', ')
  const byWhen = claim.deadline
    ? formatPartialDate(site.locale, claim.deadline)
    : claim.deadlineText
  return (
    <>
      <section className="border-b border-line-soft">
        <Container className="pt-12 pb-10">
          {claim.topic && (
            <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
              <Link href={topicPath(site.locale, claim.topic.slug)} className="text-muted">
                {claim.topic.name}
              </Link>
            </p>
          )}
          <h1 className="max-w-[30ch] text-[32px] leading-[1.1] font-semibold tracking-[-.02em] text-balance sm:text-[44px]">
            {claim.title}
          </h1>
          {claim.rating && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="sr-only">{t.claimRating}:</span>
              <RatingChip rating={claim.rating} />
              {claim.rating.definition && (
                <span className="max-w-[60ch] text-[13px] text-ink-2">
                  {claim.rating.definition}
                </span>
              )}
            </div>
          )}
        </Container>
      </section>
      <Container className="grid gap-10 pt-8 pb-12 md:grid-cols-[2fr_1fr]">
        <div className="grid gap-6">
          {claim.statement && (
            <figure>
              <figcaption className="mb-2 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
                {t.claimSaid}
              </figcaption>
              <blockquote className="border-s-4 border-line ps-4 text-[18px] leading-[1.5] whitespace-pre-line text-ink">
                {claim.statement}
              </blockquote>
            </figure>
          )}
          {claim.summary && (
            <p className="max-w-[64ch] text-[16px] leading-[1.65] whitespace-pre-line text-ink-2">
              {claim.summary}
            </p>
          )}
          {claim.sourceUrl && (
            <p className="text-[14px]">
              {t.claimSource}:{' '}
              <a href={claim.sourceUrl} rel="noopener noreferrer nofollow" className="underline">
                {new URL(claim.sourceUrl).hostname}
              </a>
              {claim.sourceLocator && <span className="text-ink-2">, {claim.sourceLocator}</span>}
            </p>
          )}
        </div>
        <dl className="grid content-start gap-5">
          <Fact label={t.claimWho}>
            <Link
              href={actorPath(site.locale, claim.country, claim.actor.slug)}
              className="underline underline-offset-2"
            >
              {claim.actor.name}
            </Link>
            {claim.coActors.map((co) => (
              <span key={co.slug}>
                {', '}
                <Link
                  href={actorPath(site.locale, claim.country, co.slug)}
                  className="underline underline-offset-2"
                >
                  {co.name}
                </Link>
              </span>
            ))}
          </Fact>
          {where && <Fact label={t.claimWhere}>{where}</Fact>}
          {when && <Fact label={t.claimWhen}>{when}</Fact>}
          {byWhen && <Fact label={t.claimByWhen}>{byWhen}</Fact>}
        </dl>
      </Container>
    </>
  )
}

/** The claim an editor marked as the actor's most important, with their note. */
export function KeyClaim({
  site,
  claim,
  note,
}: {
  site: SiteInfo
  claim: ClaimSummary
  note: string | null
}) {
  return (
    <CountrySection id="key-claim" title={site.strings.keyClaim}>
      <div className="grid gap-3 rounded-lg bg-surface px-[22px] py-5">
        <div>
          <ClaimRating claim={claim} />
        </div>
        <Link
          href={claimPath(site.locale, claim.country, claim.slug)}
          className="text-[20px] leading-[1.25] font-semibold text-ink hover:text-ink hover:opacity-80"
        >
          {claim.title}
        </Link>
        {note && <p className="max-w-[64ch] text-[15px] leading-[1.6] text-ink-2">{note}</p>}
      </div>
    </CountrySection>
  )
}

/** A topic's figures in each country that has claims on it. */
export function CountryFigures({
  site,
  countries,
  topic,
}: {
  site: SiteInfo
  countries: readonly { country: { code: string; name: string }; figures: Figures }[]
  topic: string
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
      {countries.map(({ country, figures }) => (
        <li key={country.code} className="grid gap-3">
          <Link
            href={`${topicPath(site.locale, topic)}?country=${country.code}`}
            className="text-[17px] font-semibold text-ink hover:text-ink hover:opacity-80"
          >
            {country.name}
          </Link>
          <FiguresBlock site={site} figures={figures} />
        </li>
      ))}
    </ul>
  )
}
