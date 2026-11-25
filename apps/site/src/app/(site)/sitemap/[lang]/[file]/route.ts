import type { SiteInfo } from '@promisetracker/contract'

import { findSite, getAllActors, getClaims, getCountries, getTopics } from '@/data'
import { absolute, alternates } from '@/seo'
import type { SitemapEntry } from '@/xml'
import { urlset } from '@/xml'

type Props = { params: Promise<{ lang: string; file: string }> }

/** A page's entry: its address in this language and in every other. */
function entry(site: SiteInfo, path: string): SitemapEntry {
  const { canonical, languages = {} } = alternates(site, path)
  return {
    loc: absolute(String(canonical)),
    alternates: Object.fromEntries(
      Object.entries(languages).map(([code, href]) => [code, absolute(String(href))]),
    ),
  }
}

/** Every claim in a country, following each page. */
async function claimSlugs(lang: string, code: string): Promise<string[]> {
  const slugs: string[] = []
  let cursor: string | undefined
  do {
    const page = await getClaims(lang, code, { limit: 100, cursor })
    slugs.push(...page.items.map((claim) => claim.slug))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return slugs
}

/** The pages of one language and country: the country, its officials, actors and claims. */
async function countryPaths(lang: string, code: string): Promise<string[]> {
  const [actors, past, claims] = await Promise.all([
    getAllActors(lang, code),
    getAllActors(lang, code, { stage: 'past' }),
    claimSlugs(lang, code),
  ])
  const actorSlugs = new Set([...actors, ...past].map((actor) => actor.slug))
  return [
    `/${code}`,
    `/${code}/officials`,
    ...[...actorSlugs].map((slug) => `/${code}/e/${slug}`),
    ...claims.flatMap((slug) => [`/${code}/p/${slug}`, `/${code}/p/${slug}/history`]),
  ]
}

/**
 * `/sitemap/{lang}/index.xml` lists a language's home and topic pages, and
 * `/sitemap/{lang}/{cc}.xml` one country's pages in that language.
 */
export async function GET(_request: Request, { params }: Props) {
  const { lang, file } = await params
  const site = await findSite(lang)
  const match = /^(index|[a-z]{2})\.xml$/.exec(file)
  if (!site || !match?.[1]) return new Response('Not found', { status: 404 })
  let paths: string[]
  if (match[1] === 'index') {
    const { items } = await getTopics(lang)
    paths = ['/', ...items.filter((t) => t.claims > 0).map((t) => `/topics/${t.slug}`)]
  } else {
    const code = match[1]
    const { items } = await getCountries(lang)
    if (!items.some((country) => country.code === code)) {
      return new Response('Not found', { status: 404 })
    }
    paths = await countryPaths(lang, code)
  }
  return new Response(urlset(paths.map((path) => entry(site, path))), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

/** Built per request from cached reads, so new claims appear and the build needs no database. */
export const dynamic = 'force-dynamic'
