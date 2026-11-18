import type { CountrySummary, SiteInfo } from '@promisetracker/contract'
import Image from 'next/image'
import Link from 'next/link'
import { Container } from './Container'
import { cn } from './cn'
import { Flag } from './Flag'
import { LangToggle } from './LangToggle'
import { MobileMenu } from './MobileMenu'
import { localePath } from './paths'

export type ShellData = {
  site: SiteInfo
  /** Countries published in this language. */
  countries: readonly CountrySummary[]
  /** The logo image's address. */
  logo: string
  /** The country this page belongs to, if any. */
  active?: string | undefined
}

export function Logo({
  site,
  logo,
  height = 22,
}: Pick<ShellData, 'site' | 'logo'> & { height?: number }) {
  return (
    <Link
      href={localePath(site.locale)}
      className="block hover:opacity-70"
      aria-label={site.strings.home}
    >
      <Image
        src={logo}
        alt={site.name}
        width={570}
        height={75}
        priority
        style={{ height, width: 'auto' }}
      />
    </Link>
  )
}

const navItem = (on: boolean) =>
  cn(
    '-mb-px flex items-center gap-2 border-b-2 pt-[30px] pb-[28px] whitespace-nowrap hover:opacity-70',
    on
      ? 'border-ink font-semibold text-ink hover:text-ink'
      : 'border-transparent font-medium text-ink-2 hover:text-ink-2',
  )

function Divider() {
  return <span aria-hidden="true" className="h-3.5 w-px flex-none self-center bg-line" />
}

/** Countries, then the editor's navigation links. */
export function NavLinks({ site, countries, active }: Omit<ShellData, 'logo'>) {
  const current = countries.find((c) => c.code === active)
  const extra = site.navigation.map((link) => (
    <Link key={link.url} href={link.url} className={navItem(false)}>
      {link.label}
    </Link>
  ))

  // On a country's pages: that country, with the others on hover or focus.
  if (current && countries.length > 1) {
    const others = countries.filter((c) => c.code !== current.code)
    return (
      <>
        <div className="group relative flex items-stretch">
          <Link
            href={localePath(site.locale, `/${current.code}`)}
            className={navItem(true)}
            aria-current="page"
          >
            <Flag code={current.code} size={14} />
            {current.name}
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="transition-transform duration-200 group-focus-within:rotate-180 group-hover:rotate-180"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Link>
          <div className="invisible absolute start-0 top-full z-30 min-w-[230px] -translate-y-1 opacity-0 transition-[opacity,transform,visibility] duration-200 ease-out-soft group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
            <div className="grid rounded-b-[8px] border border-t-0 border-line bg-white py-2 shadow-[0_12px_24px_-12px_rgba(0,0,0,.2)]">
              <span className="px-4 pt-1 pb-2 text-[10px] leading-none font-medium tracking-[.1em] text-muted uppercase">
                {site.strings.otherCountries}
              </span>
              {others.map((c) => (
                <Link
                  key={c.code}
                  href={localePath(site.locale, `/${c.code}`)}
                  className="flex min-h-10 items-center gap-2.5 px-4 text-[13px] leading-none font-medium tracking-normal text-ink normal-case hover:bg-surface hover:text-ink"
                >
                  <Flag code={c.code} size={16} />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
        {extra.length > 0 && <Divider />}
        {extra}
      </>
    )
  }

  return (
    <>
      {countries.map((c) => (
        <Link
          key={c.code}
          href={localePath(site.locale, `/${c.code}`)}
          className={navItem(active === c.code)}
          aria-current={active === c.code ? 'page' : undefined}
        >
          {active === c.code && <Flag code={c.code} size={14} />}
          {c.name}
        </Link>
      ))}
      {countries.length > 0 && extra.length > 0 && <Divider />}
      {extra}
    </>
  )
}

/** Full-size rows for the mobile menu. */
function MenuLinks({ site, countries, active }: Omit<ShellData, 'logo'>) {
  const row = (on: boolean) =>
    cn(
      'flex min-h-14 items-center gap-3 border-b border-line-soft py-3 text-[20px] leading-[1.2] text-ink hover:text-ink hover:opacity-70',
      on ? 'font-semibold' : 'font-medium',
    )
  return (
    <>
      {countries.map((c) => (
        <Link
          key={c.code}
          href={localePath(site.locale, `/${c.code}`)}
          className={row(active === c.code)}
          aria-current={active === c.code ? 'page' : undefined}
        >
          <Flag code={c.code} size={20} />
          {c.name}
        </Link>
      ))}
      {site.navigation.map((link) => (
        <Link key={link.url} href={link.url} className={row(false)}>
          {link.label}
        </Link>
      ))}
    </>
  )
}

/** The masthead: logo and verification line, country nav, language. */
export function SiteHeader({ overlay = false, ...data }: ShellData & { overlay?: boolean }) {
  const { site } = data
  const t = site.strings
  const hasNav = data.countries.length > 0 || site.navigation.length > 0
  return (
    <header className={cn('relative z-10 border-b', overlay ? 'border-ink/10' : 'border-line')}>
      <Container className="flex items-center gap-x-7">
        <div className="grid flex-none gap-[7px] py-4">
          <Logo site={site} logo={data.logo} />
          <span className="inline-flex items-center gap-1.5 text-[9.5px] leading-none font-medium tracking-[.1em] text-muted uppercase">
            <i aria-hidden="true" className="block size-[5px] rounded-full bg-verified" />
            {t.verified}
          </span>
        </div>
        {hasNav && (
          <nav
            aria-label={t.countriesNav}
            className="hidden min-w-0 flex-1 items-stretch gap-x-[26px] text-[11.5px] leading-none tracking-[.13em] uppercase nav:flex"
          >
            <NavLinks site={site} countries={data.countries} active={data.active} />
          </nav>
        )}
        <div className="ms-auto flex min-w-0 items-center gap-2 sm:gap-3 nav:ms-0">
          <LangToggle locale={site.locale} languages={site.languages} label={t.language} />
          {hasNav && (
            <MobileMenu
              labels={{ open: t.menu, close: t.closeMenu, nav: t.countriesNav }}
              logo={<Logo site={site} logo={data.logo} />}
              footer={
                <LangToggle locale={site.locale} languages={site.languages} label={t.language} />
              }
            >
              <MenuLinks site={site} countries={data.countries} active={data.active} />
            </MobileMenu>
          )}
        </div>
      </Container>
    </header>
  )
}
