import type {
  Claim,
  ClaimChange,
  ClaimHistory,
  ClaimUpdate,
  Evidence,
  SiteInfo,
} from '@promisetracker/contract'
import Link from 'next/link'

import { CountrySection } from './actors'
import { Container } from './Container'
import { CopyCitation } from './CopyCitation'
import { fill } from './fill'
import { formatPartialDate } from './partialDate'
import { claimPath, localePath } from './paths'
import { RatingChip } from './ratings'

/** A claim's rating history: `/{lang}/{cc}/p/{claim}/history` (section 11.1). */
export const historyPath = (locale: string, code: string, slug: string): string =>
  localePath(locale, `/${code}/p/${slug}/history`)

const longDate = (locale: string, value: string): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value))

/** "Rating last reviewed on 3 March 2026", with "Copy citation" beside it. */
export function LastReviewed({ site, claim }: { site: SiteInfo; claim: Claim }) {
  const t = site.strings
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      {claim.lastReviewedAt && (
        <p className="text-[13px] text-ink-2">
          {fill(t.lastReviewed, { date: longDate(site.locale, claim.lastReviewedAt) })}
        </p>
      )}
      <CopyCitation
        url={claim.citation.url}
        text={claim.citation.text}
        label={t.copyCitation}
        done={t.citationCopied}
      />
    </div>
  )
}

/**
 * One piece of evidence. In the timeline it is a link with its publisher;
 * the Evidence section adds the date and the finding.
 */
function EvidenceItem({
  site,
  evidence,
  compact = false,
}: {
  site: SiteInfo
  evidence: Evidence
  compact?: boolean
}) {
  const meta = [
    evidence.publisher,
    evidence.date && !compact ? formatPartialDate(site.locale, evidence.date) : null,
  ].filter(Boolean)
  return (
    <li className="grid gap-1">
      {evidence.url ? (
        <a
          href={evidence.url}
          rel="noopener noreferrer nofollow"
          className="text-[15px] font-medium underline underline-offset-2"
        >
          {evidence.title}
        </a>
      ) : (
        <span className="text-[15px] font-medium">{evidence.title}</span>
      )}
      {meta.length > 0 && <span className="text-[13px] text-ink-2">{meta.join(', ')}</span>}
      {evidence.finding && !compact && (
        <span className="max-w-[64ch] text-[14px] leading-[1.55] text-ink-2">
          {evidence.finding}
        </span>
      )}
    </li>
  )
}

/** One entry of the timeline, with its date, rating and evidence. */
function UpdateEntry({ site, update }: { site: SiteInfo; update: ClaimUpdate }) {
  const t = site.strings
  return (
    <li className="relative grid gap-2 border-s-2 border-line ps-5 pb-7 last:pb-0">
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <time dateTime={update.date.value}>{formatPartialDate(site.locale, update.date)}</time>
        {update.rating && <RatingChip rating={update.rating} />}
        {update.kind === 'correction' && (
          <span className="rounded-full border border-ink px-2 py-1 text-[10px] leading-none font-semibold tracking-[.1em] text-ink uppercase">
            {t.correction}
          </span>
        )}
      </p>
      <h3 className="text-[17px] leading-[1.3] font-semibold text-ink">{update.title}</h3>
      {update.narrative && (
        <p className="max-w-[64ch] text-[15px] leading-[1.6] whitespace-pre-line text-ink-2">
          {update.narrative}
        </p>
      )}
      {update.evidence.length > 0 && (
        <ul className="mt-1 grid gap-3">
          {update.evidence.map((e) => (
            <EvidenceItem key={e.id} site={site} evidence={e} compact />
          ))}
        </ul>
      )}
      {update.attribution && (
        <p className="text-[13px] text-ink-2">{fill(t.reportedBy, { name: update.attribution })}</p>
      )}
    </li>
  )
}

/**
 * The timeline, newest first, as a real ordered list (section 10.5). With
 * nothing to show it is left out (section 10.3).
 */
export function ClaimTimeline({
  site,
  updates,
}: {
  site: SiteInfo
  updates: readonly ClaimUpdate[]
}) {
  if (updates.length === 0) return null
  return (
    <ol reversed className="grid">
      {updates.map((update) => (
        <UpdateEntry key={update.id} site={site} update={update} />
      ))}
    </ol>
  )
}

/** The claim page's "How the rating changed" and "Evidence" sections. */
export function ClaimRecord({ site, claim }: { site: SiteInfo; claim: Claim }) {
  const t = site.strings
  return (
    <>
      {claim.timeline.length > 0 && (
        <CountrySection
          id="timeline"
          title={t.timelineTitle}
          {...(claim.updateCount > claim.timeline.length
            ? {
                more: {
                  href: historyPath(site.locale, claim.country, claim.slug),
                  label: t.fullHistory,
                },
              }
            : {})}
        >
          <ClaimTimeline site={site} updates={claim.timeline} />
        </CountrySection>
      )}
      {claim.evidence.length > 0 && (
        <CountrySection id="evidence" title={t.evidenceTitle}>
          <ul className="grid gap-4">
            {claim.evidence.map((e) => (
              <EvidenceItem key={e.id} site={site} evidence={e} />
            ))}
          </ul>
        </CountrySection>
      )}
    </>
  )
}

/** The rating history page: every published update of one claim. */
export function ClaimHistoryView({ site, history }: { site: SiteInfo; history: ClaimHistory }) {
  const t = site.strings
  const { claim } = history
  return (
    <>
      <section className="border-b border-line-soft">
        <Container className="pt-12 pb-8">
          <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
            {t.historyTitle}
          </p>
          <h1 className="max-w-[30ch] text-[28px] leading-[1.15] font-semibold tracking-[-.02em] text-balance sm:text-[36px]">
            <Link href={claimPath(site.locale, claim.country, claim.slug)} className="text-ink">
              {claim.title}
            </Link>
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {claim.rating && <RatingChip rating={claim.rating} />}
            {history.lastReviewedAt && (
              <span className="text-[13px] text-ink-2">
                {fill(t.lastReviewed, { date: longDate(site.locale, history.lastReviewedAt) })}
              </span>
            )}
          </div>
        </Container>
      </section>
      <Container className="pt-8 pb-12">
        <ClaimTimeline site={site} updates={history.updates} />
        <p className="mt-8">
          <Link
            href={claimPath(site.locale, claim.country, claim.slug)}
            className="text-[14px] font-medium tracking-[.03em]"
          >
            {t.backToClaim}
          </Link>
        </p>
      </Container>
    </>
  )
}

/** "Latest changes" on an actor's page (section 10.2). Left out with nothing to show. */
export function LatestChanges({
  site,
  changes,
}: {
  site: SiteInfo
  changes: readonly ClaimChange[]
}) {
  if (changes.length === 0) return null
  return (
    <CountrySection id="latest-changes" title={site.strings.latestChanges}>
      <ol className="grid gap-5">
        {changes.map(({ claim, update }) => (
          <li key={update.id} className="grid gap-1.5">
            <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <time dateTime={update.date.value}>
                {formatPartialDate(site.locale, update.date)}
              </time>
              {update.rating && <RatingChip rating={update.rating} />}
              {update.kind === 'correction' && (
                <span className="text-[11px] font-semibold tracking-[.1em] uppercase">
                  {site.strings.correction}
                </span>
              )}
            </p>
            <Link
              href={claimPath(site.locale, claim.country, claim.slug)}
              className="text-[16px] leading-[1.3] font-semibold text-ink"
            >
              {claim.title}
            </Link>
            <p className="text-[14px] text-ink-2">{update.title}</p>
          </li>
        ))}
      </ol>
    </CountrySection>
  )
}
