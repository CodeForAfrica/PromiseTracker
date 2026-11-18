import type { Country } from '@promisetracker/contract'

import { Container } from './Container'
import { Flag } from './Flag'

/**
 * The country's hero. The redesign's photograph and figures join it when the
 * country has an image and tracked claims.
 */
export function CountryHero({ country }: { country: Country }) {
  return (
    <section className="relative isolate flex min-h-[320px] items-end overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,14,18,.2)_0%,rgba(12,14,18,.38)_42%,rgba(12,14,18,.9)_100%)]"
      />
      <Container className="pt-16 pb-10">
        <div className="flex items-center gap-4">
          <Flag code={country.code} size={40} className="shadow-[0_0_0_2px_rgba(255,255,255,.6)]" />
          <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-.028em] text-balance text-white sm:text-[64px]">
            {country.name}
          </h1>
        </div>
        {country.about && (
          <p className="mt-3.5 max-w-[54ch] text-[16px] leading-[1.6] whitespace-pre-line text-line-2">
            {country.about}
          </p>
        )}
      </Container>
    </section>
  )
}
