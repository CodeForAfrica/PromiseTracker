import { PageShell, SubscriptionConfirmed } from '@promisetracker/ui'
import type { Metadata } from 'next'

import { confirmSubscription, LOGO, loadShell } from '@/data'

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Each link works once, so the page is rendered for every request. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

/** Where the newsletter's confirmation email leads. Opening it confirms the sign-up. */
export default async function ConfirmPage({ params, searchParams }: Props) {
  const { lang } = await params
  const { token } = await searchParams
  const shell = await loadShell(lang)
  const confirmed = typeof token === 'string' && token ? await confirmSubscription(token) : false
  return (
    <PageShell {...shell} logo={LOGO}>
      <SubscriptionConfirmed site={shell.site} confirmed={confirmed} />
    </PageShell>
  )
}
