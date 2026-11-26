import { isNotAvailable } from '@promisetracker/sdk'
import {
  Container,
  claimPath,
  localePath,
  NotAvailableNotice,
  PageShell,
  UpdateForm,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, followRedirect, getClaim, LOGO, loadShell, orNull } from '@/data'

type Props = {
  params: Promise<{ lang: string; cc: string; claim: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export function generateStaticParams(): never[] {
  return []
}

// A form is the same for everyone, but `?kind=` is read per request.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, claim } = await params
  const site = await findSite(lang)
  if (!site) return {}
  const found = await orNull(getClaim(lang, cc, claim))
  const title =
    found && !isNotAvailable(found)
      ? `${site.strings.submitUpdate}: ${found.title}`
      : site.strings.submitUpdate
  // A form has nothing a search engine should list.
  return { title, robots: { index: false, follow: true } }
}

const KINDS = ['evidence', 'correction', 'changed'] as const

/**
 * Sending an update about a claim (sections 7.9 and 11.1). `?kind=` chooses
 * new evidence, a correction or "this has changed".
 */
export default async function UpdatePage({ params, searchParams }: Props) {
  const { lang, cc, claim: slug } = await params
  const { kind: asked } = await searchParams
  const shell = await loadShell(lang)
  const claim = await orNull(getClaim(lang, cc, slug))
  if (!claim) {
    await followRedirect(lang, `/${cc}/p/${slug}/update`)
    notFound()
  }
  if (isNotAvailable(claim)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice
          site={shell.site}
          notAvailable={claim}
          path={`/${cc}/p/${slug}/update`}
        />
      </PageShell>
    )
  }
  const kind = KINDS.find((k) => k === asked) ?? 'evidence'
  const country = shell.countries.find((c) => c.code === claim.country)
  const where = claim.area?.name ?? claim.seat?.area?.name ?? country?.name ?? ''
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <Container className="pt-10 pb-14">
        <UpdateForm
          strings={shell.site.strings}
          kind={kind}
          context={{
            locale: lang,
            country: claim.country,
            claim: claim.slug,
            claimTitle: claim.title,
            actor: claim.actor.name,
            where,
            rating: claim.rating?.label ?? null,
            claimHref: claimPath(lang, claim.country, claim.slug),
            privacyHref: localePath(lang, '/privacy'),
          }}
        />
      </Container>
    </PageShell>
  )
}
