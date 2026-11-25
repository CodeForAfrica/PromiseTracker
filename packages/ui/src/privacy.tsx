import type { SiteInfo } from '@promisetracker/contract'
import Link from 'next/link'

import { Container } from './Container'
import { localePath } from './paths'

/** The privacy notice (section 13.9): what the forms collect, and why. */
export function PrivacyNotice({ site }: { site: SiteInfo }) {
  const t = site.strings
  return (
    <Container className="pt-12 pb-16">
      <h1 className="mb-6 max-w-[30ch] text-[32px] leading-[1.15] font-semibold tracking-[-.02em]">
        {t.privacyTitle}
      </h1>
      <div className="grid max-w-[68ch] gap-4 text-[16px] leading-[1.7] text-ink-2">
        {t.privacyBody.split(/\n{2,}/).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </Container>
  )
}

/** What a newsletter confirmation link shows. */
export function SubscriptionConfirmed({ site, confirmed }: { site: SiteInfo; confirmed: boolean }) {
  const t = site.strings
  return (
    <Container className="pt-12 pb-16">
      <h1 className="mb-4 text-[32px] leading-[1.15] font-semibold tracking-[-.02em]">
        {t.confirmTitle}
      </h1>
      <p role="status" className="mb-6 max-w-[60ch] text-[16px] leading-[1.7] text-ink-2">
        {confirmed ? t.confirmDone : t.confirmFailed}
      </p>
      <Link href={localePath(site.locale)} className="underline">
        {t.backHome}
      </Link>
    </Container>
  )
}
