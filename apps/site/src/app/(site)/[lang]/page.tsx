import { isNotAvailable } from '@promisetracker/sdk'
import {
  CountryPicker,
  chooseCountry,
  Explainer,
  FeaturedClaim,
  HomeHero,
  HowRatingsWork,
  InFocus,
  inFocusRule,
  listRule,
  localePath,
  Partners,
  SisterTools,
  SiteFooter,
  SiteHeader,
  SkipLink,
  shows,
  Tracked,
} from '@promisetracker/ui'

import type { Metadata } from 'next'

import {
  findSite,
  getArea,
  getClaim,
  getOverview,
  getPage,
  getTheme,
  LOGO,
  loadShell,
  orNull,
} from '@/data'
import { alternates } from '@/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  const site = await findSite(lang)
  return site ? { alternates: alternates(site, '/') } : {}
}

/** A read that may name something since unpublished, or never published in this language. */
const available = async <T,>(read: Promise<T>): Promise<Exclude<T, { error: string }> | null> => {
  const found = await orNull(read)
  return found && !isNotAvailable(found) ? (found as Exclude<T, { error: string }>) : null
}

/**
 * The homepage (section 10.2): what this is, a real claim, In focus, how a
 * rating is decided, what we have tracked, choose a country, who we work
 * with and other tools. Each section shows only with something to show, and
 * an editor can force any of them on or off (section 10.3). The live reader
 * counter is gone (D28).
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { site, countries } = await loadShell(lang)
  const forced = site.sections
  const { featuredClaim, inFocus, featuredArea } = site.picks
  const [claim, theme, area, overview, methodology] = await Promise.all([
    featuredClaim && forced['home.featured-claim'] !== 'off'
      ? available(getClaim(lang, featuredClaim.country, featuredClaim.slug))
      : null,
    inFocus && forced['home.in-focus'] !== 'off' ? available(getTheme(lang, inFocus)) : null,
    featuredArea ? available(getArea(lang, featuredArea.country, featuredArea.slug)) : null,
    getOverview(lang),
    available(getPage(lang, 'methodology')),
  ])
  const countryView = chooseCountry(forced, countries.length)
  const focus =
    theme &&
    shows(
      'home.in-focus',
      forced,
      inFocusRule({
        countries: theme.countries.length,
        claims: theme.claims.length,
        siteCountries: countries.length,
      }),
    )
  return (
    <>
      <SkipLink label={site.strings.skipToContent} />
      <SiteHeader site={site} countries={countries} logo={LOGO} overlay />
      <Explainer site={site} />
      <main id="main">
        <HomeHero site={site} />
        {claim && shows('home.featured-claim', forced, listRule(1)) && (
          <FeaturedClaim site={site} claim={claim} />
        )}
        {focus && theme && (
          <InFocus
            site={site}
            theme={theme}
            place={area && featuredArea ? { country: featuredArea.country, area } : null}
          />
        )}
        {shows('home.how-ratings-work', forced, listRule(site.ratingScales.length)) && (
          <HowRatingsWork
            site={site}
            methodology={methodology ? localePath(lang, `/${methodology.path}`) : null}
          />
        )}
        {shows('home.tracked', forced, listRule(overview.figures.total)) && (
          <Tracked site={site} overview={overview} />
        )}
        {countryView && (
          <CountryPicker site={site} countries={countries} asList={countryView === 'list'} />
        )}
        {shows('home.partners', forced, listRule(site.partners.length)) && (
          <Partners site={site} partners={site.partners} />
        )}
        {shows('home.sister-tools', forced, listRule(site.sisterTools.length)) && (
          <SisterTools site={site} tools={site.sisterTools} />
        )}
      </main>
      <SiteFooter site={site} logo={LOGO} />
    </>
  )
}
