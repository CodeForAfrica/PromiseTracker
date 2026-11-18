import type { NotAvailable, SiteInfo } from '@promisetracker/contract'
import Link from 'next/link'

import { Container } from './Container'
import { localePath } from './paths'

/**
 * Shown when a page is not published in the reader's language (section 8.3,
 * D30). It links to the same page in each language it has.
 */
export function NotAvailableNotice({
  site,
  notAvailable,
  path,
}: {
  site: SiteInfo
  notAvailable: NotAvailable
  /** The page's path without its language, such as `/ke`. */
  path: string
}) {
  const t = site.strings
  return (
    <Container className="py-24">
      <h1 className="mb-3 max-w-[30ch] text-[32px] leading-[1.1] font-semibold tracking-[-.02em]">
        {t.notAvailableTitle}
      </h1>
      <p className="mb-4 text-[15px] leading-[1.65] text-ink-2">{t.notAvailableBody}</p>
      <ul className="flex flex-wrap gap-3">
        {notAvailable.availableIn.map((language) => (
          <li key={language.code}>
            <Link
              href={localePath(language.code, path)}
              hrefLang={language.code}
              lang={language.code}
              className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-[14px] font-medium text-ink hover:text-ink hover:opacity-70"
            >
              {language.label}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  )
}

export function NotFoundNotice({ site }: { site: SiteInfo }) {
  const t = site.strings
  return (
    <Container className="py-24">
      <h1 className="mb-3 max-w-[24ch] text-[36px] leading-[1.1] font-semibold tracking-[-.02em]">
        {t.notFoundTitle}
      </h1>
      <p className="mb-7 max-w-[56ch] text-[15px] leading-[1.65] text-ink-2">{t.notFoundBody}</p>
      <Link href={localePath(site.locale)} className="text-[14px] font-medium tracking-[.03em]">
        {t.backHome}
      </Link>
    </Container>
  )
}
