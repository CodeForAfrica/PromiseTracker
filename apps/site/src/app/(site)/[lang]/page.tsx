import {
  CountryPicker,
  Explainer,
  HomeHero,
  SiteFooter,
  SiteHeader,
  SkipLink,
} from '@promisetracker/ui'

import type { Metadata } from 'next'

import { findSite, LOGO, loadShell } from '@/data'
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

/**
 * The homepage (section 10.2). Only sections with something to show appear
 * (section 10.3). The featured claim, In focus, the rating explainer and the
 * figures join it with the issues that add claims and picks.
 */
export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { site, countries } = await loadShell(lang)
  return (
    <>
      <SkipLink label={site.strings.skipToContent} />
      <SiteHeader site={site} countries={countries} logo={LOGO} overlay />
      <Explainer site={site} />
      <main id="main">
        <HomeHero site={site} />
        <CountryPicker site={site} countries={countries} />
      </main>
      <SiteFooter site={site} logo={LOGO} />
    </>
  )
}
