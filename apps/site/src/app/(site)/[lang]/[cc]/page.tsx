import { isNotAvailable } from '@promisetracker/sdk'
import { CountryHero, NotAvailableNotice, PageShell } from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, getCountry, LOGO, loadShell, NotFoundError } from '@/data'

type Props = { params: Promise<{ lang: string; cc: string }> }

/**
 * No pages are built ahead of time, so the build never needs the database.
 * Each page is rendered on its first visit and cached until a change
 * refreshes its tags (section 17).
 */
export function generateStaticParams(): never[] {
  return []
}

async function loadCountry(lang: string, cc: string) {
  try {
    return await getCountry(lang, cc)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc } = await params
  if (!(await findSite(lang))) return {}
  const country = await loadCountry(lang, cc)
  return isNotAvailable(country) ? {} : { title: country.name }
}

/**
 * A country's page (section 10.2). With no claims tracked yet it shows the
 * country alone. In focus, the snapshot, the officials and past
 * administrations appear with the issues that add them (section 10.3).
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
    </PageShell>
  )
}
