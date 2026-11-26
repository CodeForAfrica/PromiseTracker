import type { CountrySummary, SiteInfo } from '@promisetracker/contract'
import Link from 'next/link'

import { Container } from './Container'
import { Flag } from './Flag'
import { localePath } from './paths'
import { SectionLabel } from './Text'

/** What PromiseTracker is, in one heading and a paragraph. */
export function HomeHero({ site }: { site: SiteInfo }) {
  const t = site.strings
  return (
    <section className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(61deg,rgba(255,255,255,0)_60%,rgba(127,196,232,.55)_70%,rgba(27,79,216,.45)_77%,rgba(107,91,149,.45)_83%,rgba(201,59,44,.4)_89%,rgba(245,211,58,.15)_95%,rgba(255,255,255,0)_100%)] rtl:-scale-x-100"
      />
      <Container className="relative pt-12 pb-12">
        <h1 className="mb-[26px] max-w-[26ch] text-[40px] leading-[1.06] font-semibold tracking-[-.03em] text-balance sm:text-[52px] lg:text-[64px]">
          {t.headline} <span className="text-slate">{t.headlineTail}</span>
        </h1>
        <p className="max-w-[58ch] text-[16px] leading-[1.6] text-ink-2 sm:text-[18px]">{t.lede}</p>
      </Container>
    </section>
  )
}

/**
 * Choose a country (section 10.3). With one country it is a single link,
 * unless an editor forced the list on. With none it is left out.
 */
export function CountryPicker({
  site,
  countries,
  asList = countries.length > 1,
}: {
  site: SiteInfo
  countries: readonly CountrySummary[]
  asList?: boolean
}) {
  const [only] = countries
  if (!only) return null
  if (!asList) {
    return (
      <section>
        <Container className="pt-7 pb-8">
          <Link
            href={localePath(site.locale, `/${only.code}`)}
            className="inline-flex items-center gap-[9px] text-[20px] leading-[1.2] font-semibold text-ink hover:text-ink hover:opacity-70"
          >
            <Flag code={only.code} />
            {only.name}
          </Link>
        </Container>
      </section>
    )
  }
  return (
    <section aria-labelledby="choose-country">
      <Container className="pt-7 pb-8">
        <SectionLabel id="choose-country">{site.strings.chooseCountry}</SectionLabel>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-px overflow-hidden rounded-lg bg-tile sm:-mx-[22px]">
          {countries.map((c) => (
            <li key={c.code} className="bg-white px-[22px] py-5">
              <Link
                href={localePath(site.locale, `/${c.code}`)}
                className="flex items-center gap-[9px] text-ink hover:text-ink hover:opacity-70"
              >
                <Flag code={c.code} />
                <span className="text-[20px] leading-[1.2] font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
