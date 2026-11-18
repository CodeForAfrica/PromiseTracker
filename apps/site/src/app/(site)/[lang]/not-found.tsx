import { NotFoundNotice, PageShell } from '@promisetracker/ui'

import { DEFAULT_LOCALE, getCountries, getSite, LOGO } from '@/data'

// A not-found page receives no params, so it is shown in the default language.
export default async function NotFound() {
  const site = await getSite(DEFAULT_LOCALE)
  const { items } = await getCountries(DEFAULT_LOCALE)
  return (
    <PageShell site={site} countries={items} logo={LOGO}>
      <NotFoundNotice site={site} />
    </PageShell>
  )
}
