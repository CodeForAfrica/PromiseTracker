import type { SiteInfo } from '@promisetracker/contract'

export function SiteHeader({ site }: { site: SiteInfo }) {
  return (
    <header>
      <h1>{site.name}</h1>
      {site.tagline ? <p>{site.tagline}</p> : null}
    </header>
  )
}
