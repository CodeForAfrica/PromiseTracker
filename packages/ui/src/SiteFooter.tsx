import type { SiteInfo } from '@promisetracker/contract'
import Image from 'next/image'
import Link from 'next/link'

import { Container } from './Container'
import { SubscribeForm } from './forms'
import { localePath } from './paths'

/**
 * The footer: what the site is, the newsletter sign-up, the editor's links
 * and the copyright line.
 */
export function SiteFooter({ site, logo }: { site: SiteInfo; logo: string }) {
  const t = site.strings
  return (
    <footer className="mt-auto border-t border-line">
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
          <div className="grid gap-2">
            <p className="text-[20px] leading-[1.2] font-bold tracking-[-.02em] text-ink">
              {t.subscribe}
            </p>
            <p className="text-[14px] text-ink-2">{t.subscribeLine}</p>
            <SubscribeForm
              strings={t}
              locale={site.locale}
              privacyHref={localePath(site.locale, '/privacy')}
            />
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
