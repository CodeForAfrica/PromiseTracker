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
} from '@promisetracker/ui'
import type { Metadata } from 'next'

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
  const { country: asked } = await searchParams
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
  const lists = await Promise.all(
    shown.map(({ country: c }) =>
      orNotFound(getClaims(lang, c.code, { topic: slug, limit: country ? 100 : PER_COUNTRY })),
    ),
  )
  const claims: ClaimSummary[] = lists.flatMap((list) => list.items)

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
      </CountrySection>
    </PageShell>
  )
}
