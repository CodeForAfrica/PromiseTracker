import { isNotAvailable } from '@promisetracker/sdk'
import { ClaimHistoryView, NotAvailableNotice, PageShell } from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, followRedirect, getClaimHistory, LOGO, loadShell, orNull } from '@/data'

type Props = { params: Promise<{ lang: string; cc: string; claim: string }> }

export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, claim } = await params
  const site = await findSite(lang)
  if (!site) return {}
  const found = await orNull(getClaimHistory(lang, cc, claim))
  return found && !isNotAvailable(found)
    ? { title: `${site.strings.historyTitle}: ${found.claim.title}` }
    : {}
}

/**
 * A claim's full rating history (section 11.1): every published update,
 * newest first. A renamed slug leads here permanently.
 */
export default async function ClaimHistoryPage({ params }: Props) {
  const { lang, cc, claim: slug } = await params
  const shell = await loadShell(lang)
  const history = await orNull(getClaimHistory(lang, cc, slug))
  if (!history) {
    await followRedirect(lang, `/${cc}/p/${slug}/history`)
    notFound()
  }
  if (isNotAvailable(history)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice
          site={shell.site}
          notAvailable={history}
          path={`/${cc}/p/${slug}/history`}
        />
      </PageShell>
    )
  }
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <ClaimHistoryView site={shell.site} history={history} />
    </PageShell>
  )
}
