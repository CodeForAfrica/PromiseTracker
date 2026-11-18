'use client'

import type { Language } from '@promisetracker/contract'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { localePath, withoutLocale } from './paths'

/**
 * The language switch. It keeps the reader on the same page, since slugs are
 * not translated (section 11.2). Shown only when the site runs in more than
 * one language.
 */
export function LangToggle({
  locale,
  languages,
  label,
}: {
  locale: string
  languages: readonly Language[]
  label: string
}) {
  const pathname = usePathname() || '/'
  if (languages.length < 2) return null
  const path = withoutLocale(
    pathname,
    languages.map((l) => l.code),
  )
  return (
    <nav
      aria-label={label}
      className="inline-flex flex-none items-center rounded-full border border-line bg-white px-3 py-2 text-[10.5px] leading-none font-medium tracking-[.1em] text-ink uppercase"
    >
      {languages.map((language, i) => (
        <span key={language.code} className="inline-flex items-center">
          {i > 0 && <span aria-hidden="true">{' / '}</span>}
          {language.code === locale ? (
            <span aria-current="true" title={language.label}>
              {language.code}
            </span>
          ) : (
            <Link
              href={localePath(language.code, path)}
              hrefLang={language.code}
              lang={language.code}
              title={language.label}
              // Muted rather than the redesign's paler grey, which fails WCAG AA contrast.
              className="text-muted hover:text-muted hover:opacity-70"
            >
              {language.code}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
