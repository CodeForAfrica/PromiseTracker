import type { Country, SiteInfo } from '@promisetracker/contract'
import { isNotAvailable } from '@promisetracker/sdk'
import {
  ActorGrid,
  Container,
  CountryHero,
  CountryInFocus,
  CountrySection,
  listRule,
  localePath,
  NotAvailableNotice,
  OfficeLinks,
  PageShell,
  pastRule,
  peopleRule,
  Snapshot,
  shows,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import {
  findSite,
  getActors,
  getClaims,
  getCountry,
  getOffices,
  LOGO,
  loadShell,
  orNotFound,
} from '@/data'
import { EditorPage, editorPageMetadata, isCountrySegment } from '@/editorPage'
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
  if (!isCountrySegment(cc)) return editorPageMetadata(lang, cc)
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
  const forced = site.sections
  const delivering = shows('country.who-is-delivering', forced, peopleRule(currentHolders))
  const officials = shows('country.officials', forced, peopleRule(currentHolders))
  const former = shows('country.past-administrations', forced, pastRule(pastTerms))
  const [leaders, offices, past] = await Promise.all([
    currentHolders > 0
      ? orNotFound(getActors(lang, code, { stage: 'current', sort: 'office', limit: 4 }))
      : null,
    officials ? orNotFound(getOffices(lang, code)) : null,
    former ? orNotFound(getActors(lang, code, { stage: 'past', limit: 6 })) : null,
  ])
  return (
    <>
      {/* With one office holder, the page leads with them (section 10.3). */}
      {!delivering && currentHolders === 1 && leaders && (
        <Container className="pt-7">
          <ActorGrid site={site} code={code} actors={leaders.items} />
        </Container>
      )}
      {delivering && leaders && (
        <CountrySection id="who-is-delivering" title={t.whoIsDelivering}>
          <ActorGrid site={site} code={code} actors={leaders.items} />
        </CountrySection>
      )}
      {officials && offices && (
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
 * A country's page (section 10.2): the country, In focus, the snapshot, then
 * the people in office and those who held office before. Any other first
 * segment is an editor page.
 */
export default async function CountryPage({ params }: Props) {
  const { lang, cc } = await params
  if (!isCountrySegment(cc)) return <EditorPage lang={lang} path={cc} />
  const shell = await loadShell(lang)
  const country = await loadCountry(lang, cc)

  if (isNotAvailable(country)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={country} path={`/${cc}`} />
      </PageShell>
    )
  }

  const forced = shell.site.sections
  const { actors: pickedActors, claims: pickedClaims } = country.picks
  // The snapshot is the figures of every published claim in the country.
  const { figures } = await orNotFound(getClaims(lang, country.code, { limit: 1 }))
  return (
    <PageShell {...shell} logo={LOGO} active={country.code}>
      <CountryHero country={country} />
      {shows('country.in-focus', forced, listRule(pickedActors.length + pickedClaims.length)) && (
        <CountryInFocus
          site={shell.site}
          code={country.code}
          actors={pickedActors}
          claims={pickedClaims}
        />
      )}
      {shows('country.snapshot', forced, listRule(figures.total)) && (
        <Snapshot site={shell.site} figures={figures} />
      )}
      <PeopleSections site={shell.site} country={country} />
    </PageShell>
  )
}
