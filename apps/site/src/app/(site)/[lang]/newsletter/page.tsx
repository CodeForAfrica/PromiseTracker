import { ConfirmSignup, Container, PageShell } from '@promisetracker/ui'
import type { Metadata } from 'next'

import { findSite, LOGO, loadShell } from '@/data'

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// The token is read per request, and the page is for one reader only.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  const site = await findSite(lang)
  return site
    ? { title: site.strings.newsletterTitle, robots: { index: false, follow: false } }
    : {}
}

/**
 * Where the newsletter's confirmation email leads (section 13.9). The reader
 * presses a button to confirm, so a mail scanner opening the link does not.
 */
export default async function NewsletterPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { token } = await searchParams
  const shell = await loadShell(lang)
  const t = shell.site.strings
  return (
    <PageShell {...shell} logo={LOGO}>
      <Container className="pt-12 pb-14">
        <h1 className="mb-4 text-[32px] leading-[1.1] font-semibold tracking-[-.02em]">
          {t.newsletterTitle}
        </h1>
        <p className="mb-6 max-w-[52ch] text-[16px] text-ink-2">{t.subscribeLine}</p>
        <ConfirmSignup strings={t} token={typeof token === 'string' ? token : ''} />
      </Container>
    </PageShell>
  )
}
