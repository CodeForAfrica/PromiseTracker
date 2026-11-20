import type { ClaimSummary } from '@promisetracker/contract'
import { isNotAvailable } from '@promisetracker/sdk'
import {
  ClaimFilters,
  ClaimList,
  Container,
  CountryFigures,
  CountrySection,
  NotAvailableNotice,
  PageShell,
  topicPath,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import Link from 'next/link'

import { findSite, getClaims, getTopic, LOGO, loadShell, orNotFound } from '@/data'

type Props = {
  params: Promise<{ lang: string; topic: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, topic } = await params
  if (!(await findSite(lang))) return {}
  const found = await orNotFound(getTopic(lang, topic))
  return isNotAvailable(found) ? {} : { title: found.name }
}

/** How many of each country's latest claims a topic page lists. */
const PER_COUNTRY = 10

/**
 * A topic's page (section 10.2): the claims on the subject, with figures by
 * country. `?country=ke` lists one country's claims.
 */
export default async function TopicPage({ params, searchParams }: Props) {
  const { lang, topic: slug } = await params
  const { country: asked, cursor: rawCursor } = await searchParams
  const shell = await loadShell(lang)
  const topic = await orNotFound(getTopic(lang, slug))
  if (isNotAvailable(topic)) {
    return (
      <PageShell {...shell} logo={LOGO}>
        <NotAvailableNotice site={shell.site} notAvailable={topic} path={`/topics/${slug}`} />
      </PageShell>
    )
  }
  const t = shell.site.strings
  const country = topic.countries.find((c) => c.country.code === asked)?.country.code ?? null
  const shown = country
    ? topic.countries.filter((c) => c.country.code === country)
    : topic.countries
  // One country's claims page through with a cursor. Every country's together
  // show each one's latest, with a link to the rest.
  const cursor =
    country && typeof rawCursor === 'string' && /^\d+$/.test(rawCursor) ? rawCursor : undefined
  const lists = await Promise.all(
    shown.map(({ country: c }) =>
      orNotFound(
        getClaims(lang, c.code, { topic: slug, limit: country ? undefined : PER_COUNTRY, cursor }),
      ),
    ),
  )
  const claims: ClaimSummary[] = lists.flatMap((list) => list.items)
  const nextCursor = country ? lists[0]?.nextCursor : null
  const next = nextCursor
    ? `${topicPath(lang, topic.slug)}?${new URLSearchParams({ country: country ?? '', cursor: nextCursor })}`
    : null
  // Without a country, a country with more claims than shown links to all of them.
  const more = country
    ? []
    : shown.filter((_, i) => (lists[i]?.total ?? 0) > PER_COUNTRY).map((c) => c.country)

  return (
    <PageShell {...shell} logo={LOGO}>
      <section className="border-b border-line-soft">
        <Container className="pt-12 pb-10">
          {topic.parent && (
            <p className="mb-3 text-[11px] font-semibold tracking-[.12em] text-muted uppercase">
              {topic.parent.name}
            </p>
          )}
          <h1 className="text-[36px] leading-[1.1] font-semibold tracking-[-.02em] sm:text-[48px]">
            {topic.name}
          </h1>
          {topic.description && (
            <p className="mt-3 max-w-[60ch] text-[16px] leading-[1.6] text-ink-2">
              {topic.description}
            </p>
          )}
        </Container>
      </section>
      {topic.countries.length > 0 && (
        <CountrySection id="by-country" title={t.figuresByCountry}>
          <CountryFigures site={shell.site} countries={topic.countries} topic={topic.slug} />
        </CountrySection>
      )}
      <CountrySection id="claims" title={t.claimsOnTopic}>
        {topic.countries.length > 1 && (
          <ClaimFilters
            site={shell.site}
            fields={[
              {
                name: 'country',
                label: t.filterCountry,
                choices: topic.countries.map((c) => ({
                  value: c.country.code,
                  label: c.country.name,
                })),
              },
            ]}
            selected={{ country: country ?? '' }}
          />
        )}
        {claims.length === 0 ? (
          <p className="text-[15px] text-ink-2">{t.noClaims}</p>
        ) : (
          <ClaimList site={shell.site} claims={claims} />
        )}
        {next && (
          <p className="mt-6">
            <Link href={next} className="text-[14px] font-medium tracking-[.03em]">
              {t.nextPage}
            </Link>
          </p>
        )}
        {more.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {more.map((c) => (
              <li key={c.code}>
                <Link
                  href={`${topicPath(lang, topic.slug)}?country=${c.code}`}
                  className="text-[14px] font-medium tracking-[.03em]"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CountrySection>
    </PageShell>
  )
}
