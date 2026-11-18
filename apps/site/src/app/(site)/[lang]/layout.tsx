import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'

import { DEFAULT_LOCALE, findSite, getSite } from '@/data'

import '../globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

type Props = { children: ReactNode; params: Promise<{ lang: string }> }

/**
 * No pages are built ahead of time, so the build never needs the database.
 * Each page is rendered on its first visit and cached until a change
 * refreshes its tags (section 17).
 */
export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { lang } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.description ?? site.strings.lede,
  }
}

/**
 * Every public page sits under its language. The page sets the document's
 * language and direction, so right-to-left languages lay out correctly. An
 * address in a language the site does not run in renders the not-found page
 * in the default language.
 */
export default async function LanguageLayout({ children, params }: Props) {
  const { lang } = await params
  const site = (await findSite(lang)) ?? (await getSite(DEFAULT_LOCALE))
  const language = site.languages.find((l) => l.code === site.locale)
  return (
    <html lang={site.locale} dir={language?.rtl ? 'rtl' : 'ltr'} className={inter.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  )
}
