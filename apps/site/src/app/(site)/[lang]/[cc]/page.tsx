import type { Country, SiteInfo } from '@promisetracker/contract'
import { isNotAvailable } from '@promisetracker/sdk'
import {
  ActorGrid,
  Container,
  CountryHero,
  CountrySection,
  localePath,
  NotAvailableNotice,
  OfficeLinks,
  PageShell,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import { findSite, getActors, getCountry, getOffices, LOGO, loadShell, orNotFound } from '@/data'
import { alternates } from '@/seo'

type Props = { params: Promise<{ lang: string; cc: string }> }

/**
 * No pages are built ahead of time, so the build never needs the database.
 * Each page is rendered on its first visit and cached until a change
 * refreshes its tags (section 17).
 */
export function generateStaticParams(): never[] {
  return []
}

const loadCountry = (lang: string, cc: string) => orNotFound(getCountry(lang, cc))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc } = await params
  const site = await findSite(lang)
  if (!site) return {}
  const country = await loadCountry(lang, cc)
  return isNotAvailable(country)
    ? {}
    : { title: country.name, alternates: alternates(site, `/${country.code}`) }
}

/**
 * The sections about the people in office, each shown only when its rule in
 * section 10.3 is met. With one office holder, the page leads with them.
 */
async function PeopleSections({ site, country }: { site: SiteInfo; country: Country }) {
  const { currentHolders, pastTerms } = country.counts
  const lang = site.locale
  const code = country.code
  const t = site.strings
  const [leaders, offices, past] = await Promise.all([
    currentHolders > 0
      ? orNotFound(getActors(lang, code, { stage: 'current', sort: 'office', limit: 4 }))
      : null,
    currentHolders >= 2 ? orNotFound(getOffices(lang, code)) : null,
    pastTerms > 0 ? orNotFound(getActors(lang, code, { stage: 'past', limit: 6 })) : null,
  ])
  return (
    <>
      {currentHolders === 1 && leaders && (
        <Container className="pt-7">
          <ActorGrid site={site} code={code} actors={leaders.items} />
        </Container>
      )}
      {currentHolders >= 2 && leaders && (
        <CountrySection id="who-is-delivering" title={t.whoIsDelivering}>
          <ActorGrid site={site} code={code} actors={leaders.items} />
        </CountrySection>
      )}
      {currentHolders >= 2 && offices && (
        <CountrySection
          id="officials"
          title={t.officials}
          more={{ href: localePath(lang, `/${code}/officials`), label: t.seeAllOfficials }}
        >
          <OfficeLinks site={site} code={code} offices={offices.items} />
        </CountrySection>
      )}
      {past && past.items.length > 0 && (
        <CountrySection id="past-administrations" title={t.pastAdministrations}>
          <ActorGrid site={site} code={code} actors={past.items} label={t.formerHolder} />
        </CountrySection>
      )}
    </>
  )
}

/**
 * A country's page (section 10.2): the country, then the people in office
 * and those who held office before. In focus and the snapshot join it with
 * claims.
 */
export default async function CountryPage({ params }: Props) {
  const { lang, cc } = await params
  const shell = await loadShell(lang)
  const country = await loadCountry(lang, cc)

  if (isNotAvailable(country)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={country} path={`/${cc}`} />
      </PageShell>
    )
  }

  return (
    <PageShell {...shell} logo={LOGO} active={country.code}>
      <CountryHero country={country} />
      <PeopleSections site={shell.site} country={country} />
    </PageShell>
  )
}
