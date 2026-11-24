import { PageShell, SearchView } from '@promisetracker/ui'
import type { Metadata } from 'next'

import { findSite, LOGO, loadShell, search } from '@/data'

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The contract's limits on `q` (section 12.2). Shorter text shows the box alone. */
const MIN_QUERY = 2
const MAX_QUERY = 100

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  const site = await findSite(lang)
  // Results change as the record does, and each address is someone's words.
  return site ? { title: site.strings.search, robots: { index: false, follow: true } } : {}
}

/**
 * The search page (section 10.2): `/en/search?q=nairobi`. A place comes with
 * everyone who represents it, from the president down, then people, claims
 * and topics. `?country=ke` keeps to one country. The address holds the
 * search, so results can be shared.
 */
export default async function SearchPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { q: rawQ, country: rawCountry } = await searchParams
  const shell = await loadShell(lang)
  const query = typeof rawQ === 'string' ? rawQ.trim().slice(0, MAX_QUERY) : ''
  const country =
    typeof rawCountry === 'string' && /^[a-z]{2}$/.test(rawCountry) ? rawCountry : undefined
  const results =
    query.length >= MIN_QUERY ? await search(lang, query, country ? { country } : {}) : null
  return (
    <PageShell {...shell} logo={LOGO}>
      <SearchView site={shell.site} query={query} results={results} />
    </PageShell>
  )
}
