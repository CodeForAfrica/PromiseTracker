import type {
  Actor,
  ActorList,
  ActorRef,
  AreaSummary,
  Holder,
  Office,
  SeatHolders,
  SeatRef,
  SiteInfo,
  Term,
} from '@promisetracker/contract'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { Container } from './Container'
import { fill } from './fill'
import { localePath } from './paths'
import { SectionLabel } from './Text'

/** An actor's page: `/{lang}/{cc}/e/{actor}` (section 11.1). */
export const actorPath = (locale: string, code: string, slug: string): string =>
  localePath(locale, `/${code}/e/${slug}`)

/** "Governor, Nairobi County", or the office alone for a national seat. */
export const seatLabel = ({ office, area }: SeatRef): string =>
  area ? `${office.name}, ${area.name}` : office.name

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

/** A photo, or the actor's initials when there is none. */
function Portrait({ actor, size }: { actor: Holder; size: number }) {
  const style = { width: size, height: size }
  if (actor.image) {
    return (
      // Media comes from the platform's own storage, at any size, so it is shown as it is.
      // biome-ignore lint/performance/noImgElement: plain image, no optimiser configured for media
      <img
        src={actor.image.url}
        alt=""
        width={size}
        height={size}
        style={style}
        className="shrink-0 rounded-full bg-tile object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-tile text-[14px] font-semibold text-ink-2"
    >
      {initials(actor.name)}
    </span>
  )
}

/** One holder, linking to their page. */
export function HolderCard({
  site,
  code,
  holder,
  seat,
}: {
  site: SiteInfo
  code: string
  holder: Holder
  seat?: string | null
}) {
  return (
    <Link
      href={actorPath(site.locale, code, holder.slug)}
      className="flex items-center gap-4 text-ink hover:text-ink hover:opacity-80"
    >
      <Portrait actor={holder} size={48} />
      <span className="min-w-0">
        <span className="block text-[17px] leading-[1.25] font-semibold">{holder.name}</span>
        {seat && <span className="block text-[13px] leading-normal text-ink-2">{seat}</span>}
        {holder.party && (
          <span className="block text-[12px] leading-normal text-muted">{holder.party.name}</span>
        )}
      </span>
    </Link>
  )
}

const grid =
  'grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-px overflow-hidden rounded-lg bg-tile'

/** Actors in a grid of cards, each with the seat they hold. */
export function ActorGrid({
  site,
  code,
  actors,
  label,
}: {
  site: SiteInfo
  code: string
  actors: ActorList['items']
  /** What to say under a name when the actor holds no seat today. */
  label?: string
}) {
  return (
    <ul className={grid}>
      {actors.map((actor) => {
        const [first] = actor.seats
        return (
          <li key={actor.slug} className="bg-white px-[22px] py-5">
            <HolderCard
              site={site}
              code={code}
              holder={actor}
              seat={first ? seatLabel(first) : (label ?? null)}
            />
          </li>
        )
      })}
    </ul>
  )
}

/** A section of the country page, with a heading and an optional link below. */
export function CountrySection({
  id,
  title,
  children,
  more,
}: {
  id: string
  title: string
  children: ReactNode
  more?: { href: string; label: string }
}) {
  return (
    <section aria-labelledby={id}>
      <Container className="pt-7 pb-8">
        <SectionLabel id={id}>{title}</SectionLabel>
        {children}
        {more && (
          <p className="mt-5">
            <Link href={more.href} className="text-[14px] font-medium tracking-[.03em]">
              {more.label}
            </Link>
          </p>
        )}
      </Container>
    </section>
  )
}

/** The offices of a country, each linking to the officials list filtered by it. */
export function OfficeLinks({
  site,
  code,
  offices,
}: {
  site: SiteInfo
  code: string
  offices: readonly Office[]
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {offices.map((office) => (
        <li key={office.slug}>
          <Link
            href={`${localePath(site.locale, `/${code}/officials`)}?office=${office.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[14px] text-ink hover:border-ink hover:text-ink"
          >
            {office.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}

const dateFormat = (locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** "25 August 2022 – present". */
export function termDates(site: SiteInfo, term: Pick<Term, 'startsOn' | 'endsOn'>): string {
  const format = dateFormat(site.locale)
  const start = format.format(new Date(term.startsOn))
  const end = term.endsOn ? format.format(new Date(term.endsOn)) : site.strings.present
  return `${start} – ${end}`
}

/** A link to an actor inside a line of text, underlined so it stands out from the words. */
function ActorLink({ site, code, actor }: { site: SiteInfo; code: string; actor: ActorRef }) {
  return (
    <Link href={actorPath(site.locale, code, actor.slug)} className="underline underline-offset-2">
      {actor.name}
    </Link>
  )
}

/**
 * The top of an actor's page (section 10.2). A past office holder keeps the
 * page and is marked as former (section 11.2).
 */
export function ActorHero({ site, code, actor }: { site: SiteInfo; code: string; actor: Actor }) {
  const archived = actor.stage === 'past'
  return (
    <section className="border-b border-line-soft">
      <Container className="flex flex-col gap-6 pt-12 pb-10 sm:flex-row sm:items-end">
        <Portrait actor={actor} size={112} />
        <div className="min-w-0">
          {archived && (
            <p className="mb-2 text-[11px] leading-[1.6] font-semibold tracking-[.12em] text-muted uppercase">
              {site.strings.formerHolder}
            </p>
          )}
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-.025em] text-balance sm:text-[48px]">
            {actor.honorific ? `${actor.honorific} ${actor.name}` : actor.name}
          </h1>
          {actor.seats.length > 0 && (
            <p className="mt-2 text-[16px] leading-normal text-ink-2">
              {actor.seats.map(seatLabel).join(' · ')}
            </p>
          )}
          {actor.party && (
            <p className="mt-1 text-[14px] leading-normal text-muted">
              <ActorLink site={site} code={code} actor={actor.party} />
            </p>
          )}
          {actor.image?.credit && (
            <p className="mt-2 text-[11px] text-faint">
              {fill(site.strings.photoCredit, { credit: actor.image.credit })}
            </p>
          )}
        </div>
      </Container>
    </section>
  )
}

/** Who this is: the biography and links. Left out when there are neither (section 10.3). */
export function WhoThisIs({ site, actor }: { site: SiteInfo; actor: Actor }) {
  if (!actor.biography && actor.links.length === 0) return null
  return (
    <CountrySection id="who-this-is" title={site.strings.whoThisIs}>
      {actor.biography && (
        <p className="max-w-[64ch] text-[16px] leading-[1.65] whitespace-pre-line text-ink-2">
          {actor.biography}
        </p>
      )}
      {actor.links.length > 0 && (
        <ul aria-label={site.strings.links} className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {actor.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="noopener noreferrer" className="text-[14px]">
                {link.type === 'website' ? new URL(link.url).hostname : link.type}
              </a>
            </li>
          ))}
        </ul>
      )}
    </CountrySection>
  )
}

/** Every term the actor has held, the latest first. */
export function TermList({ site, code, actor }: { site: SiteInfo; code: string; actor: Actor }) {
  if (actor.terms.length === 0) return null
  return (
    <CountrySection id="terms" title={site.strings.timeInOffice}>
      <ol className="divide-y divide-line-soft border-y border-line-soft">
        {actor.terms.map((term) => (
          <li
            key={`${term.office.slug}-${term.area?.slug ?? ''}-${term.startsOn}`}
            className="py-4"
          >
            <div className="text-[17px] leading-[1.3] font-semibold text-ink">
              {seatLabel(term)}
            </div>
            <div className="mt-1 text-[13px] leading-normal text-ink-2">
              {termDates(site, term)}
              {term.party && (
                <>
                  {' · '}
                  <ActorLink site={site} code={code} actor={term.party} />
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </CountrySection>
  )
}

/**
 * How the last term closed, and who came next. Only for a past office holder
 * whose term has a summary (section 10.3).
 */
export function ClosingSummary({
  site,
  code,
  actor,
}: {
  site: SiteInfo
  code: string
  actor: Actor
}) {
  if (actor.stage !== 'past') return null
  const last = actor.terms.find((term) => term.stage === 'past')
  if (!last || (!last.closingSummary && !last.successor)) return null
  return (
    <CountrySection id="closing-summary" title={site.strings.closingSummary}>
      {last.closingSummary && (
        <p className="max-w-[64ch] text-[16px] leading-[1.65] whitespace-pre-line text-ink-2">
          {last.closingSummary}
        </p>
      )}
      {last.successor && (
        <p className="mt-4 text-[14px] text-ink-2">
          {site.strings.succeededBy}: <ActorLink site={site} code={code} actor={last.successor} />
        </p>
      )}
    </CountrySection>
  )
}

/** A seat's page: its holders, or a line saying no one holds it (section 11.2). */
export function SeatPage({
  site,
  code,
  seat,
}: {
  site: SiteInfo
  code: string
  seat: SeatHolders
}) {
  return (
    <Container className="pt-12 pb-12">
      <h1 className="mb-8 text-[36px] leading-[1.1] font-semibold tracking-[-.02em]">
        {seatLabel(seat)}
      </h1>
      {seat.holders.length === 0 ? (
        <p className="text-[15px] text-ink-2">{site.strings.noHolder}</p>
      ) : (
        <ul className={grid}>
          {seat.holders.map((holder) => (
            <li key={holder.slug} className="bg-white px-[22px] py-5">
              <HolderCard site={site} code={code} holder={holder} />
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}

type Choice = { value: string; label: string }

/**
 * The officials list's filters (section 11.1). A plain form, so the filters
 * live in the address and work without JavaScript.
 */
export function OfficialsFilters({
  site,
  offices,
  areas,
  parties,
  selected,
}: {
  site: SiteInfo
  offices: readonly Choice[]
  areas: readonly Choice[]
  parties: readonly Choice[]
  selected: Readonly<Record<'office' | 'area' | 'party' | 'sort', string>>
}) {
  const t = site.strings
  const field = 'flex flex-col gap-1 text-[12px] font-medium text-ink-2'
  const control = 'min-h-11 rounded border border-line bg-white px-3 text-[14px] text-ink'
  const select = (name: 'office' | 'area' | 'party', label: string, choices: readonly Choice[]) =>
    choices.length > 0 && (
      <div className={field}>
        <label htmlFor={`filter-${name}`}>{label}</label>
        <select id={`filter-${name}`} name={name} defaultValue={selected[name]} className={control}>
          <option value="">{t.filterAll}</option>
          {choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
    )
  return (
    <form method="get" className="mb-8 flex flex-wrap items-end gap-4">
      {select('office', t.filterOffice, offices)}
      {select('area', t.filterArea, areas)}
      {select('party', t.filterParty, parties)}
      <div className={field}>
        <label htmlFor="filter-sort">{t.sortBy}</label>
        <select id="filter-sort" name="sort" defaultValue={selected.sort} className={control}>
          <option value="office">{t.sortOffice}</option>
          <option value="name">{t.sortName}</option>
        </select>
      </div>
      <button
        type="submit"
        className="min-h-11 rounded-full bg-ink px-5 text-[14px] font-medium text-white"
      >
        {t.showResults}
      </button>
    </form>
  )
}

export const toChoices = (records: readonly { slug: string; name: string }[]): Choice[] =>
  records.map((r) => ({ value: r.slug, label: r.name }))

export const areaChoices = (actors: ActorList['items']): Choice[] => {
  const areas = new Map<string, AreaSummary>()
  for (const actor of actors)
    for (const seat of actor.seats) if (seat.area) areas.set(seat.area.slug, seat.area)
  return toChoices([...areas.values()].sort((a, b) => a.name.localeCompare(b.name)))
}
