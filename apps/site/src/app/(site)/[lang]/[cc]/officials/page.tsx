import type { ActorQuery } from '@promisetracker/sdk'
import { isNotAvailable } from '@promisetracker/sdk'
import {
  ActorGrid,
  areaChoices,
  Container,
  localePath,
  NotAvailableNotice,
  OfficialsFilters,
  PageShell,
  toChoices,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import Link from 'next/link'

import {
  findSite,
  getActors,
  getAllActors,
  getCountry,
  getOffices,
  LOGO,
  loadShell,
  orNotFound,
} from '@/data'

type Props = {
  params: Promise<{ lang: string; cc: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A filter's value from the address, if it could be a slug. Anything else is ignored. */
const slugParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && SLUG.test(value) ? value : undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params
  const site = await findSite(lang)
  return site ? { title: site.strings.officials } : {}
}

/**
 * The officials list (section 11.1): everyone holding an office today,
 * filtered by office, area and party, and sorted. The filters live in the
 * address, so a filtered list can be shared.
 */
export default async function OfficialsPage({ params, searchParams }: Props) {
  const { lang, cc } = await params
  const raw = await searchParams
  const shell = await loadShell(lang)
  const country = await orNotFound(getCountry(lang, cc))
  if (isNotAvailable(country)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={country} path={`/${cc}/officials`} />
      </PageShell>
    )
  }
  const sort = raw.sort === 'name' ? 'name' : 'office'
  const cursor = typeof raw.cursor === 'string' && /^\d+$/.test(raw.cursor) ? raw.cursor : undefined
  const filters = {
    office: slugParam(raw.office),
    area: slugParam(raw.area),
    party: slugParam(raw.party),
  }
  const query: ActorQuery = { stage: 'current', sort, ...filters, ...(cursor ? { cursor } : {}) }
  const [list, offices, parties, everyone] = await Promise.all([
    orNotFound(getActors(lang, cc, query)),
    orNotFound(getOffices(lang, cc)),
    // Every party, and the areas of everyone in office, so no choice is missing.
    orNotFound(getAllActors(lang, cc, { kind: 'party' })),
    orNotFound(getAllActors(lang, cc, { stage: 'current' })),
  ])
  const t = shell.site.strings
  const next = list.nextCursor
    ? `${localePath(lang, `/${cc}/officials`)}?${new URLSearchParams(
        Object.entries({ ...filters, sort, cursor: list.nextCursor }).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )}`
    : null

  return (
    <PageShell {...shell} logo={LOGO} active={country.code}>
      <Container className="pt-12 pb-12">
        <h1 className="mb-8 text-[36px] leading-[1.1] font-semibold tracking-[-.02em]">
          {t.officials}
        </h1>
        <OfficialsFilters
          site={shell.site}
          offices={toChoices(offices.items)}
          areas={areaChoices(everyone)}
          parties={toChoices(parties)}
          selected={{
            office: filters.office ?? '',
            area: filters.area ?? '',
            party: filters.party ?? '',
            sort,
          }}
        />
        {list.items.length === 0 ? (
          <p className="text-[15px] text-ink-2">{t.noMatches}</p>
        ) : (
          <ActorGrid site={shell.site} code={country.code} actors={list.items} />
        )}
        {next && (
          <p className="mt-6">
            <Link href={next} className="text-[14px] font-medium tracking-[.03em]">
              {t.nextPage}
            </Link>
          </p>
        )}
      </Container>
    </PageShell>
  )
}
