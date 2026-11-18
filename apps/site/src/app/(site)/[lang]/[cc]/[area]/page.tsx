import { isNotAvailable } from '@promisetracker/sdk'
import {
  AreaHero,
  AreaSeatsOnly,
  actorPath,
  NotAvailableNotice,
  PageShell,
  SeatList,
  SeatPage,
  seatLabel,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import {
  findSite,
  followRedirect,
  getArea,
  getCountry,
  getSeat,
  LOGO,
  loadShell,
  orNotFound,
  orNull,
} from '@/data'

type Props = { params: Promise<{ lang: string; cc: string; area: string }> }

/** Rendered on the first visit and cached, like every page (section 17). */
export function generateStaticParams(): never[] {
  return []
}

/** The segment after the country is an area or a national office (section 11.2). */
async function load(lang: string, cc: string, slug: string) {
  const area = await orNull(getArea(lang, cc, slug))
  if (area) return { area, seat: null }
  return { area: null, seat: await orNull(getSeat(lang, cc, slug)) }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, area: slug } = await params
  if (!(await findSite(lang))) return {}
  const { area, seat } = await load(lang, cc, slug)
  if (area && !isNotAvailable(area)) return { title: area.name }
  if (seat && !isNotAvailable(seat)) return { title: seatLabel(seat) }
  return {}
}

/**
 * An area's page, or a national seat's (sections 10.2 and 11.2).
 *
 * - An area with one seat and one holder leads to that holder.
 * - An area with a page of its own shows its hero and its seats' holders.
 *   One without lists its seats.
 * - A national seat with one holder leads to them. One with several lists them.
 * - A renamed area or office leads to its new address.
 */
export default async function AreaPage({ params }: Props) {
  const { lang, cc, area: slug } = await params
  const shell = await loadShell(lang)
  const { area, seat } = await load(lang, cc, slug)
  const found = area ?? seat
  if (found && isNotAvailable(found)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={found} path={`/${cc}/${slug}`} />
      </PageShell>
    )
  }

  if (seat && !isNotAvailable(seat)) {
    const [only] = seat.holders
    if (seat.holders.length === 1 && only) redirect(actorPath(lang, cc, only.slug))
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <SeatPage site={shell.site} code={cc} seat={seat} />
      </PageShell>
    )
  }

  if (!area || isNotAvailable(area)) {
    await followRedirect(lang, `/${cc}/${slug}`)
    notFound()
  }
  if (area.type === 'country' || area.seats.length === 0) notFound()
  const [single] = area.seats
  const [holder] = single?.holders ?? []
  if (area.seats.length === 1 && single?.holders.length === 1 && holder) {
    redirect(actorPath(lang, cc, holder.slug))
  }

  const country = await orNotFound(getCountry(lang, cc))
  if (isNotAvailable(country)) notFound()
  return (
    <PageShell {...shell} logo={LOGO} active={country.code}>
      {area.hasPage ? (
        <>
          <AreaHero site={shell.site} country={country} area={area} />
          <SeatList
            site={shell.site}
            code={country.code}
            area={area}
            title={shell.site.strings.answersFor}
          />
        </>
      ) : (
        <AreaSeatsOnly site={shell.site} code={country.code} area={area} />
      )}
    </PageShell>
  )
}
