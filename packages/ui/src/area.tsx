import type { Area, SiteInfo } from '@promisetracker/contract'
import Link from 'next/link'

import { Container } from './Container'
import { localePath } from './paths'
import { SectionLabel } from './Text'

/** Replaces `{name}` placeholders in interface text. */
export const fill = (template: string, values: Readonly<Record<string, string>>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)

type Props = { site: SiteInfo; country: { code: string; name: string }; area: Area }

/** The country, then each area above this one. The whole-country area is the country. */
function Breadcrumb({ site, country, area }: Props) {
  const above = area.ancestors.filter((a) => a.type !== 'country')
  const separator = <span aria-hidden="true">{'  ›  '}</span>
  return (
    <nav
      aria-label={site.strings.breadcrumb}
      className="mb-3 text-[11px] leading-[1.6] font-medium tracking-[.12em] uppercase"
    >
      <Link
        href={localePath(site.locale, `/${country.code}`)}
        className="text-white hover:text-white hover:opacity-80"
      >
        {country.name}
      </Link>
      {above.map((a) => (
        <span key={a.slug}>
          {separator}
          <Link
            href={localePath(site.locale, `/${country.code}/${a.slug}`)}
            className="text-white hover:text-white hover:opacity-80"
          >
            {a.name}
          </Link>
        </span>
      ))}
      {separator}
      <span aria-current="page">{area.name}</span>
    </nav>
  )
}

/** The area's hero, from the redesign's county page. Photographs and figures join it later. */
export function AreaHero(props: Props) {
  return (
    <section className="relative isolate flex min-h-[320px] items-end overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,14,18,.2)_0%,rgba(12,14,18,.38)_42%,rgba(12,14,18,.9)_100%)]"
      />
      <Container className="pt-16 pb-10">
        <Breadcrumb {...props} />
        <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-.028em] text-balance text-white sm:text-[64px]">
          {props.area.name}
        </h1>
      </Container>
    </section>
  )
}

/**
 * The seats that answer for an area (section 10.2). Their holders, with
 * their figures, arrive with terms.
 */
export function SeatList({ area, title }: { area: Area; title: string }) {
  if (area.seats.length === 0) return null
  return (
    <section aria-labelledby="seats">
      <Container className="pt-7 pb-8">
        <SectionLabel id="seats">{title}</SectionLabel>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-px overflow-hidden rounded-lg bg-tile">
          {area.seats.map((seat) => (
            <li key={seat.office.slug} className="bg-white px-[22px] py-5">
              <div className="text-[18px] leading-[1.25] font-semibold text-ink">
                {seat.office.name}
              </div>
              {seat.office.shortName && seat.office.shortName !== seat.office.name && (
                <div className="mt-1 text-[12px] leading-normal text-muted">
                  {seat.office.shortName}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/**
 * An area without a page of its own lists its seats under a plain heading
 * (section 11.2).
 */
export function AreaSeatsOnly({ site, area }: { site: SiteInfo; area: Area }) {
  return (
    <>
      <Container className="pt-12">
        <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-.02em]">{area.name}</h1>
      </Container>
      <SeatList area={area} title={fill(site.strings.seatsInArea, { area: area.name })} />
    </>
  )
}
