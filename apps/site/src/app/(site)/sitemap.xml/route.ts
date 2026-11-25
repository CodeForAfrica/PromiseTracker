import { DEFAULT_LOCALE, getCountries, getSite } from '@/data'
import { absolute } from '@/seo'
import { sitemapIndex } from '@/xml'

const HEADERS = { 'Content-Type': 'application/xml; charset=utf-8' }

/**
 * `/sitemap.xml` (section 11.3): a sitemap index with one child per language
 * and country, and one per language for its home and topic pages.
 */
export async function GET() {
  const site = await getSite(DEFAULT_LOCALE)
  const children: string[] = []
  for (const { code: lang } of site.languages) {
    children.push(absolute(`/sitemap/${lang}/index.xml`))
    const { items } = await getCountries(lang)
    for (const country of items) children.push(absolute(`/sitemap/${lang}/${country.code}.xml`))
  }
  return new Response(sitemapIndex(children), { headers: HEADERS })
}

/** Built per request from cached reads, so new claims appear and the build needs no database. */
export const dynamic = 'force-dynamic'
