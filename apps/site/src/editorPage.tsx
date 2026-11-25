import 'server-only'

import { isNotAvailable } from '@promisetracker/sdk'
import { EditorPageView, NotAvailableNotice, PageShell } from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { findSite, getPage, LOGO, loadShell, orNull } from '@/data'

/**
 * Editor pages live at `/{lang}/{page}`, nested (section 11.1). A two-letter
 * first segment is a country, so the country, area and seat routes hand any
 * other address here (section 11.2).
 */

/** Whether an address's first segment is a country code rather than an editor page. */
export const isCountrySegment = (segment: string): boolean => /^[a-z]{2}$/.test(segment)

export async function editorPageMetadata(lang: string, path: string): Promise<Metadata> {
  if (!(await findSite(lang))) return {}
  const page = await orNull(getPage(lang, path))
  if (!page || isNotAvailable(page)) return {}
  return { title: page.title, ...(page.summary ? { description: page.summary } : {}) }
}

/** The page at this address, the sister site it leads to, or the not-found page. */
export async function EditorPage({ lang, path }: { lang: string; path: string }) {
  const shell = await loadShell(lang)
  const page = await orNull(getPage(lang, path))
  if (!page) notFound()
  if (isNotAvailable(page)) {
    return (
      <PageShell {...shell} logo={LOGO}>
        <NotAvailableNotice site={shell.site} notAvailable={page} path={`/${path}`} />
      </PageShell>
    )
  }
  // A page marked as a link leads to the sister site (section 7.7).
  if (page.link) redirect(page.link)
  return (
    <PageShell {...shell} logo={LOGO}>
      <EditorPageView site={shell.site} page={page} />
    </PageShell>
  )
}
