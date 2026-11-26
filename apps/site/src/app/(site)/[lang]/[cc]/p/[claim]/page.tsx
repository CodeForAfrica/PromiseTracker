import { isNotAvailable } from '@promisetracker/sdk'
import {
  analysisRule,
  ClaimView,
  LatestAnalysis,
  NotAvailableNotice,
  PageShell,
  shows,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, followRedirect, getClaim, LOGO, loadShell, orNull } from '@/data'
import { alternates, jsonLd } from '@/seo'
import { claimReview } from '@/structured'

type Props = { params: Promise<{ lang: string; cc: string; claim: string }> }

export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, claim } = await params
  const site = await findSite(lang)
  if (!site) return {}
  const found = await orNull(getClaim(lang, cc, claim))
  return found && !isNotAvailable(found)
    ? {
        title: found.title,
        description: found.summary ?? found.statement ?? null,
        alternates: alternates(site, `/${cc}/p/${found.slug}`),
      }
    : {}
}

/**
 * A claim's page (section 10.2): the claim with who, where, when and by when,
 * and its rating. A renamed slug leads here permanently. The page is rendered
 * on the server and ships no JavaScript of its own, to stay well under the
 * 150 KB budget (section 17).
 */
export default async function ClaimPage({ params }: Props) {
  const { lang, cc, claim: slug } = await params
  const shell = await loadShell(lang)
  const claim = await orNull(getClaim(lang, cc, slug))
  if (!claim) {
    await followRedirect(lang, `/${cc}/p/${slug}`)
    notFound()
  }
  if (isNotAvailable(claim)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={claim} path={`/${cc}/p/${slug}`} />
      </PageShell>
    )
  }
  const review = claimReview(shell.site, claim)
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      {review && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: escaped by jsonLd
          dangerouslySetInnerHTML={{ __html: jsonLd(review) }}
        />
      )}
      <ClaimView site={shell.site} claim={claim} />
      {shows('claim.latest-analysis', shell.site.sections, analysisRule(claim.analysis.length)) && (
        <LatestAnalysis site={shell.site} articles={claim.analysis} />
      )}
    </PageShell>
  )
}
