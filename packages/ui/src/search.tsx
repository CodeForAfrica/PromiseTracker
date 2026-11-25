import type { SearchItem, SearchResults, SiteInfo } from '@promisetracker/contract'
import Link from 'next/link'

import { HolderCard, seatLabel } from './actors'
import { Container } from './Container'
import { fill } from './fill'
import { localePath } from './paths'
import { SectionLabel } from './Text'

/** The search page: `/{lang}/search?q=` (section 11.1). */
export const searchPath = (locale: string, q?: string): string =>
  localePath(locale, q ? `/search?${new URLSearchParams({ q })}` : '/search')

export function SearchIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  )
}

/** The search box. A plain form, so it works before any script loads. */
export function SearchForm({ site, query = '' }: { site: SiteInfo; query?: string }) {
  const t = site.strings
  return (
    <search>
      <form
        action={searchPath(site.locale)}
        className="flex h-14 items-center gap-2.5 rounded-full border border-line bg-white py-1.5 ps-5 pe-1.5"
      >
        <SearchIcon className="flex-none text-ink" />
        <label htmlFor="q" className="sr-only">
          {t.searchLabel}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={t.searchPlaceholder}
          minLength={2}
          maxLength={100}
          required
          className="min-w-0 flex-1 bg-transparent text-[16px] leading-none font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted"
        />
        <button
          type="submit"
          className="flex h-11 flex-none cursor-pointer items-center rounded-full bg-ink px-5 text-[11px] leading-none font-medium tracking-[.06em] text-white uppercase hover:opacity-85"
        >
          {t.search}
        </button>
      </form>
    </search>
  )
}

function ItemList({ site, items }: { site: SiteInfo; items: readonly SearchItem[] }) {
  return (
    <ul className="divide-y divide-line-soft border-y border-line-soft">
      {items.map((item) => (
        <li key={item.url}>
          <Link
            href={localePath(site.locale, item.url)}
            className="block py-3.5 text-[16px] leading-[1.35] font-medium text-ink hover:text-ink hover:opacity-70"
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * What a search found: each place with everyone who represents it, from the
 * president down, then people, claims and topics (section 10.2). Before a
 * search, the box and a line on what to search for.
 */
export function SearchView({
  site,
  query,
  results,
}: {
  site: SiteInfo
  query: string
  results: SearchResults | null
}) {
  const t = site.strings
  const lede = !results
    ? t.searchIntro
    : results.total === 0
      ? fill(t.searchNothing, { q: query })
      : fill(t.searchFound, {
          q: query,
          places: String(results.places.length),
          people: String(results.actors.length),
          claims: String(results.claims.length),
          topics: String(results.topics.length),
        })
  return (
    <>
      <section className="border-b border-line-soft">
        <Container className="pt-12 pb-10">
          <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
            {results ? t.searchResults : t.search}
          </p>
          <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-.02em] break-words sm:text-[48px]">
            {results ? query : t.searchTitle}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.6] text-ink-2" aria-live="polite">
            {lede}
          </p>
          <div className="mt-6 max-w-[640px]">
            <SearchForm site={site} query={query} />
          </div>
        </Container>
      </section>

      {results?.places.map((place) => (
        <section key={`${place.country}/${place.area.slug}`} aria-label={place.area.name}>
          <Container className="pt-7 pb-8">
            <SectionLabel rule>{fill(t.whoRepresents, { place: place.area.name })}</SectionLabel>
            <p className="-mt-3 mb-5">
              <Link
                href={localePath(site.locale, `/${place.country}/${place.area.slug}`)}
                className="text-[14px] font-medium tracking-[.03em]"
              >
                {fill(t.openPlace, { place: place.area.name })}
              </Link>
            </p>
            {place.representatives.length === 0 ? (
              <p className="text-[15px] text-ink-2">{t.noHolder}</p>
            ) : (
              <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-px overflow-hidden rounded-lg bg-tile">
                {place.representatives.flatMap((seat) =>
                  seat.holders.map((holder) => (
                    <li
                      key={`${seat.office.slug}/${seat.area?.slug ?? ''}/${holder.slug}`}
                      className="bg-white px-[22px] py-5"
                    >
                      <HolderCard
                        site={site}
                        code={place.country}
                        holder={holder}
                        seat={seatLabel(seat)}
                      />
                    </li>
                  )),
                )}
              </ul>
            )}
          </Container>
        </section>
      ))}

      {[
        { key: 'people', title: t.searchPeople, items: results?.actors ?? [] },
        { key: 'claims', title: t.searchClaims, items: results?.claims ?? [] },
        { key: 'topics', title: t.searchTopics, items: results?.topics ?? [] },
      ]
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <section key={group.key} aria-labelledby={`search-${group.key}`}>
            <Container className="pt-7 pb-8">
              <SectionLabel rule id={`search-${group.key}`}>
                {group.title}
              </SectionLabel>
              <ItemList site={site} items={group.items} />
            </Container>
          </section>
        ))}
    </>
  )
}
