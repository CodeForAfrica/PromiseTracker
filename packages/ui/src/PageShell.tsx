import type { ReactNode } from 'react'

import { Container } from './Container'
import { Disclosure } from './Disclosure'
import { SiteFooter } from './SiteFooter'
import type { ShellData } from './SiteHeader'
import { SiteHeader } from './SiteHeader'

/** A link past the header, for keyboard and screen reader users. */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="sr-only rounded-full bg-ink px-4 py-2 text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 hover:text-white"
    >
      {label}
    </a>
  )
}

/**
 * The short explanation of the site, collapsed by default, on every page
 * (section 10.2). Left out until an editor writes it.
 */
export function Explainer({ site }: Pick<ShellData, 'site'>) {
  if (!site.explainer) return null
  return (
    <div className="border-b border-line-soft">
      <Container>
        <Disclosure summary={site.description ?? site.strings.aboutSite}>
          {site.explainer}
        </Disclosure>
      </Container>
    </div>
  )
}

/** The standard page frame: masthead, explainer, the page, footer. */
export function PageShell({ children, ...data }: ShellData & { children: ReactNode }) {
  return (
    <>
      <SkipLink label={data.site.strings.skipToContent} />
      <SiteHeader {...data} />
      <Explainer site={data.site} />
      <main id="main">{children}</main>
      <SiteFooter site={data.site} logo={data.logo} />
    </>
  )
}
