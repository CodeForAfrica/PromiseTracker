import { isNotAvailable } from '@promisetracker/sdk'
import {
  ActorHero,
  ClosingSummary,
  NotAvailableNotice,
  PageShell,
  TermList,
  WhoThisIs,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, followRedirect, getActor, LOGO, loadShell, orNull } from '@/data'

type Props = { params: Promise<{ lang: string; cc: string; actor: string }> }

export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, actor } = await params
  if (!(await findSite(lang))) return {}
  const found = await orNull(getActor(lang, cc, actor))
  return found && !isNotAvailable(found) ? { title: found.name } : {}
}

/**
 * An actor's page (sections 10.2 and 11.2). Its address never changes: a
 * past office holder keeps it and shows the archived record. A renamed slug
 * leads here permanently. The record so far, the key claim and the claim list
 * join it with claims.
 */
export default async function ActorPage({ params }: Props) {
  const { lang, cc, actor: slug } = await params
  const shell = await loadShell(lang)
  const actor = await orNull(getActor(lang, cc, slug))
  if (!actor) {
    await followRedirect(lang, `/${cc}/e/${slug}`)
    notFound()
  }
  if (isNotAvailable(actor)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={actor} path={`/${cc}/e/${slug}`} />
      </PageShell>
    )
  }
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <ActorHero site={shell.site} code={cc} actor={actor} />
      <WhoThisIs site={shell.site} actor={actor} />
      <TermList site={shell.site} code={cc} actor={actor} />
      <ClosingSummary site={shell.site} code={cc} actor={actor} />
    </PageShell>
  )
}
