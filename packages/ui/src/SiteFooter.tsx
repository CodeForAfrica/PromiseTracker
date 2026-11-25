import type { SiteInfo } from '@promisetracker/contract'
import Image from 'next/image'
import Link from 'next/link'

import { Container } from './Container'
import { SubscribeForm } from './forms'
import { localePath } from './paths'

/** The privacy notice (section 13.9), linked from both public forms. */
export const privacyPath = (locale: string) => localePath(locale, '/privacy')

/**
 * The footer: the newsletter sign-up, what the site is, the editor's links
 * and the copyright line. Partners and sister tools join it with the issues
 * that add them.
 */
export function SiteFooter({ site, logo }: { site: SiteInfo; logo: string }) {
  const t = site.strings
  return (
    <footer className="mt-auto border-t border-line">
      <div className="border-b border-line">
        <Container className="flex flex-wrap items-center justify-between gap-x-10 gap-y-6 py-10">
          <div>
            <h2 className="text-[32px] leading-[1.1] font-bold tracking-[-.025em] text-ink">
              {t.subscribe}
            </h2>
            <p className="mt-2 text-[15px] leading-normal text-ink-2">{t.subscribeLine}</p>
          </div>
          <SubscribeForm strings={t} locale={site.locale} privacyHref={privacyPath(site.locale)} />
        </Container>
      </div>
      <Container className="pt-8 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6">
          <div className="max-w-[660px] flex-[1_1_460px]">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
              <Image
                src={logo}
                alt={site.name}
                width={570}
                height={75}
                style={{ height: 28, width: 'auto' }}
              />
              <span className="text-[12.5px] leading-none text-ink-2">{t.initiative}</span>
              <span className="text-[15px] leading-none font-bold tracking-[-.015em] text-ink">
                Code for <span className="text-link">Africa</span>
              </span>
            </div>
            {site.footer.about && (
              <p className="mt-4 text-[14px] leading-[1.7] whitespace-pre-line text-ink-2">
                {site.footer.about}
              </p>
            )}
          </div>
        </div>

        {site.footer.links.length > 0 && (
          <nav
            aria-label={t.footerNav}
            className="mt-9 flex flex-wrap gap-x-[30px] gap-y-2.5 border-y border-line-soft py-[22px] text-[15px] leading-[1.3]"
          >
            {site.footer.links.map((link) => (
              <Link key={link.url} href={link.url} className="text-ink-2 hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="mt-[22px] text-[13.5px] leading-[1.4] text-muted">{t.copyright}</div>
      </Container>
    </footer>
  )
}
