import { isNotAvailable } from '@promisetracker/sdk'
import { ArticleView, NotAvailableNotice, PageShell } from '@promisetracker/ui'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { findSite, followRedirect, getArticle, LOGO, loadShell, orNull } from '@/data'

type Props = { params: Promise<{ lang: string; cc: string; article: string }> }

/** Rendered on the first visit and cached, like every page (section 17). */
export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, article } = await params
  if (!(await findSite(lang))) return {}
  const found = await orNull(getArticle(lang, cc, article))
  if (!found || isNotAvailable(found)) return {}
  return {
    title: found.title,
    ...(found.standfirst ? { description: found.standfirst } : {}),
  }
}

/** An article (section 7.7): analysis of a claim, an actor or a country. */
export default async function ArticlePage({ params }: Props) {
  const { lang, cc, article: slug } = await params
  const shell = await loadShell(lang)
  const article = await orNull(getArticle(lang, cc, slug))
  if (!article) {
    await followRedirect(lang, `/${cc}/a/${slug}`)
    notFound()
  }
  if (isNotAvailable(article)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={article} path={`/${cc}/a/${slug}`} />
      </PageShell>
    )
  }
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <ArticleView site={shell.site} article={article} />
    </PageShell>
  )
}
