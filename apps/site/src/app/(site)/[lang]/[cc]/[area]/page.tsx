import { isNotAvailable } from '@promisetracker/sdk'
import {
  AreaHero,
  AreaSeatsOnly,
  NotAvailableNotice,
  PageShell,
  SeatList,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, getArea, getCountry, LOGO, loadShell, orNotFound } from '@/data'

type Props = { params: Promise<{ lang: string; cc: string; area: string }> }

/** Rendered on the first visit and cached, like every page (section 17). */
export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, area } = await params
  if (!(await findSite(lang))) return {}
  const result = await orNotFound(getArea(lang, cc, area))
  return isNotAvailable(result) ? {} : { title: result.name }
}

/**
 * An area's page (sections 10.2 and 11.2). An area with a page of its own
 * shows its hero and the seats that answer for it. One without lists its
 * seats. The holders of each seat, and the redirect to a single seat's
 * holder, arrive with terms in #646.
 */
export default async function AreaPage({ params }: Props) {
  const { lang, cc, area: slug } = await params
  const shell = await loadShell(lang)
  const [area, country] = await Promise.all([
    orNotFound(getArea(lang, cc, slug)),
    orNotFound(getCountry(lang, cc)),
  ])
  if (isNotAvailable(area)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={area} path={`/${cc}/${slug}`} />
      </PageShell>
    )
  }
  if (isNotAvailable(country)) notFound()
  if (area.type === 'country' || area.seats.length === 0) notFound()

  return (
    <PageShell {...shell} logo={LOGO} active={country.code}>
      {area.hasPage ? (
        <>
          <AreaHero site={shell.site} country={country} area={area} />
          <SeatList area={area} title={shell.site.strings.answersFor} />
        </>
      ) : (
        <AreaSeatsOnly site={shell.site} area={area} />
      )}
    </PageShell>
  )
}
