import { SiteHeader } from '@promisetracker/ui'

import { sdk } from '@/platform/sdk'

// Reads live data on every request until caching arrives with the public site.
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const site = await sdk.getSiteInfo()
  return (
    <main>
      <SiteHeader site={site} />
    </main>
  )
}
