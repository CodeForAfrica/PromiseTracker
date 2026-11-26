import { PageShell, PrivacyNotice } from '@promisetracker/ui'
import type { Metadata } from 'next'

import { findSite, LOGO, loadShell } from '@/data'

type Props = { params: Promise<{ lang: string }> }

export function generateStaticParams(): never[] {
  return []
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  const site = await findSite(lang)
  return site ? { title: site.strings.privacy } : {}
}

/** The privacy notice (section 13.9), linked from the update form and the newsletter sign-up. */
export default async function PrivacyPage({ params }: Props) {
  const { lang } = await params
  const shell = await loadShell(lang)
  return (
    <PageShell {...shell} logo={LOGO}>
      <PrivacyNotice site={shell.site} />
    </PageShell>
  )
}
