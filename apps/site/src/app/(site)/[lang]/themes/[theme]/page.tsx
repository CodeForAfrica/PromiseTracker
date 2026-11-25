import { isNotAvailable } from '@promisetracker/sdk'
import { NotAvailableNotice, PageShell, ThemeView } from '@promisetracker/ui'
import type { Metadata } from 'next'

import { findSite, getTheme, LOGO, loadShell, orNotFound } from '@/data'

type Props = { params: Promise<{ lang: string; theme: string }> }

/** Rendered on the first visit and cached, like every page (section 17). */
export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, theme } = await params
  if (!(await findSite(lang))) return {}
  const found = await orNotFound(getTheme(lang, theme))
  return isNotAvailable(found)
    ? {}
    : { title: found.title, ...(found.introduction ? { description: found.introduction } : {}) }
}

/** A theme's page (section 10.2): its claims across countries, with figures by country. */
export default async function ThemePage({ params }: Props) {
  const { lang, theme: slug } = await params
  const shell = await loadShell(lang)
  const theme = await orNotFound(getTheme(lang, slug))
  if (isNotAvailable(theme)) {
    return (
      <PageShell {...shell} logo={LOGO}>
        <NotAvailableNotice site={shell.site} notAvailable={theme} path={`/themes/${slug}`} />
      </PageShell>
    )
  }
  return (
    <PageShell {...shell} logo={LOGO}>
      <ThemeView site={shell.site} theme={theme} />
    </PageShell>
  )
}
