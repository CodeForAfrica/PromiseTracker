import { isNotAvailable } from '@promisetracker/sdk'
import {
  actorPath,
  Container,
  claimPath,
  kindOf,
  NotAvailableNotice,
  PageShell,
  privacyPath,
  seatLabel,
  UpdateForm,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, getClaim, LOGO, loadShell, orNull } from '@/data'

type Props = {
  params: Promise<{ lang: string; cc: string; claim: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** `?kind=` is read on each request. */
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, claim } = await params
  const site = await findSite(lang)
  if (!site) return {}
  const found = await orNull(getClaim(lang, cc, claim))
  return found && !isNotAvailable(found)
    ? { title: `${site.strings.send}: ${found.title}`, robots: { index: false, follow: true } }
    : {}
}

/**
 * The update form (sections 7.9 and 12.1): new evidence, a correction or a
 * note that something has changed, about one claim. `?kind=` chooses the kind.
 * It posts to `POST /api/v1/submissions`.
 */
export default async function UpdatePage({ params, searchParams }: Props) {
  const { lang, cc, claim: slug } = await params
  const { kind } = await searchParams
  const shell = await loadShell(lang)
  const claim = await orNull(getClaim(lang, cc, slug))
  if (!claim) notFound()
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
  const where = claim.area?.name ?? (claim.seat ? seatLabel(claim.seat) : '')
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <Container className="pt-10 pb-12">
        <UpdateForm
          strings={shell.site.strings}
          locale={lang}
          country={cc}
          claim={claim.slug}
          initialKind={kindOf(typeof kind === 'string' ? kind : null)}
          initialWhere={where}
          context={{
            claim: claim.title,
            actor: claim.actor.name,
            where,
            rating: claim.rating?.label ?? '',
          }}
          claimHref={claimPath(lang, cc, claim.slug)}
          actorHref={actorPath(lang, cc, claim.actor.slug)}
          privacyHref={privacyPath(lang)}
        />
      </Container>
    </PageShell>
  )
}
