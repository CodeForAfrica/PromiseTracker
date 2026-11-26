import { isNotAvailable } from '@promisetracker/sdk'
import { actorPath, NotAvailableNotice, PageShell, SeatPage, seatLabel } from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { findSite, followRedirect, getSeat, LOGO, loadShell, orNull } from '@/data'
import { EditorPage, editorPageMetadata, isCountrySegment } from '@/editorPage'
import { alternates } from '@/seo'

type Props = { params: Promise<{ lang: string; cc: string; area: string; office: string }> }

export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, area, office } = await params
  if (!isCountrySegment(cc)) return editorPageMetadata(lang, `${cc}/${area}/${office}`)
  const site = await findSite(lang)
  if (!site) return {}
  const seat = await orNull(getSeat(lang, cc, office, area))
  return seat && !isNotAvailable(seat)
    ? { title: seatLabel(seat), alternates: alternates(site, `/${cc}/${area}/${office}`) }
    : {}
}

/**
 * A seat's address follows the seat (section 11.2): it leads to whoever holds
 * it today, or lists them when there are several. A renamed area or office
 * leads to the seat's new address.
 */
export default async function SeatAddress({ params }: Props) {
  const { lang, cc, area, office } = await params
  // A first segment that is not a country is an editor page (section 11.2).
  if (!isCountrySegment(cc)) return <EditorPage lang={lang} path={`${cc}/${area}/${office}`} />
  const shell = await loadShell(lang)
  const seat = await orNull(getSeat(lang, cc, office, area))
  if (!seat) {
    await followRedirect(lang, `/${cc}/${area}/${office}`)
    notFound()
  }
  if (isNotAvailable(seat)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice
          site={shell.site}
          notAvailable={seat}
          path={`/${cc}/${area}/${office}`}
        />
      </PageShell>
    )
  }
  const [only] = seat.holders
  if (seat.holders.length === 1 && only) redirect(actorPath(lang, cc, only.slug))
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <SeatPage site={shell.site} code={cc} seat={seat} />
    </PageShell>
  )
}
