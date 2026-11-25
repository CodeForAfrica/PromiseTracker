import { isNotAvailable } from '@promisetracker/sdk'
import {
  ActorHero,
  analysisRule,
  ClaimFilters,
  ClaimList,
  ClosingSummary,
  CountrySection,
  FiguresBlock,
  KeyClaim,
  LatestAnalysis,
  LatestChanges,
  listRule,
  localePath,
  NotAvailableNotice,
  PageShell,
  ratingChoices,
  shows,
  TermList,
  topicChoices,
  WhoThisIs,
} from '@promisetracker/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  findSite,
  followRedirect,
  getActor,
  getClaims,
  getTopics,
  LOGO,
  loadShell,
  orNotFound,
  orNull,
} from '@/data'

type Props = {
  params: Promise<{ lang: string; cc: string; actor: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A filter's value from the address, if it could be a slug. Anything else is ignored. */
const slugParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === 'string' && SLUG.test(value) ? value : undefined

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, cc, actor } = await params
  if (!(await findSite(lang))) return {}
  const found = await orNull(getActor(lang, cc, actor))
  return found && !isNotAvailable(found) ? { title: found.name } : {}
}

/**
 * An actor's page (sections 10.2 and 11.2). Its address never changes: a
 * past office holder keeps it and shows the archived record. A renamed slug
 * leads here permanently. Their claims follow, filtered by rating and topic
 * in the address.
 */
export default async function ActorPage({ params, searchParams }: Props) {
  const { lang, cc, actor: slug } = await params
  const raw = await searchParams
  const shell = await loadShell(lang)
  const actor = await orNull(getActor(lang, cc, slug))
  if (!actor) {
    await followRedirect(lang, `/${cc}/e/${slug}`)
    notFound()
  }
  if (isNotAvailable(actor)) {
    return (
      <PageShell {...shell} logo={LOGO} active={cc}>
        <NotAvailableNotice site={shell.site} notAvailable={actor} path={`/${cc}/e/${slug}`} />
      </PageShell>
    )
  }
  const filters = { rating: slugParam(raw.rating), topic: slugParam(raw.topic) }
  const cursor = typeof raw.cursor === 'string' && /^\d+$/.test(raw.cursor) ? raw.cursor : undefined
  const [claims, topics] = await Promise.all([
    actor.record.total > 0
      ? orNotFound(getClaims(lang, cc, { actor: actor.slug, ...filters, cursor }))
      : null,
    actor.record.total > 0 ? orNotFound(getTopics(lang)) : null,
  ])
  const t = shell.site.strings
  const forced = shell.site.sections
  const next = claims?.nextCursor
    ? `${localePath(lang, `/${cc}/e/${actor.slug}`)}?${new URLSearchParams(
        Object.entries({ ...filters, cursor: claims.nextCursor }).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )}`
    : null
  return (
    <PageShell {...shell} logo={LOGO} active={cc}>
      <ActorHero site={shell.site} code={cc} actor={actor} />
      <WhoThisIs site={shell.site} actor={actor} />
      {actor.keyClaim && (
        <KeyClaim site={shell.site} claim={actor.keyClaim.claim} note={actor.keyClaim.note} />
      )}
      {actor.record.total > 0 && (
        <CountrySection id="record" title={t.recordSoFar}>
          <FiguresBlock site={shell.site} figures={actor.record} />
        </CountrySection>
      )}
      {claims && (
        <CountrySection id="claims" title={t.claims}>
          <ClaimFilters
            site={shell.site}
            fields={[
              { name: 'rating', label: t.filterRating, choices: ratingChoices(shell.site) },
              {
                name: 'topic',
                label: t.filterTopic,
                choices: topicChoices((topics?.items ?? []).filter((topic) => topic.claims > 0)),
              },
            ]}
            selected={{ rating: filters.rating ?? '', topic: filters.topic ?? '' }}
          />
          {claims.items.length === 0 ? (
            <p className="text-[15px] text-ink-2">{t.noClaims}</p>
          ) : (
            <ClaimList site={shell.site} claims={claims.items} showActor={false} />
          )}
          {next && (
            <p className="mt-6">
              <Link href={next} className="text-[14px] font-medium tracking-[.03em]">
                {t.nextPage}
              </Link>
            </p>
          )}
        </CountrySection>
      )}
      {shows('actor.latest-changes', forced, listRule(actor.latestChanges.length)) && (
        <LatestChanges site={shell.site} changes={actor.latestChanges} />
      )}
      {shows('actor.latest-analysis', forced, analysisRule(actor.analysis.length)) && (
        <LatestAnalysis site={shell.site} articles={actor.analysis} />
      )}
      <TermList site={shell.site} code={cc} actor={actor} />
      {forced['actor.closing-summary'] !== 'off' && (
        <ClosingSummary site={shell.site} code={cc} actor={actor} />
      )}
    </PageShell>
  )
}
