/**
 * The machine addresses of section 11.3, written as text. These functions
 * only format: the routes load the data.
 */

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

/** Control characters XML 1.0 forbids. Text pasted from a PDF can carry them. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters removed
const FORBIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g

export const escapeXml = (text: string): string =>
  text.replace(FORBIDDEN, '').replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c)

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>'

/** `/sitemap.xml`: one child sitemap per language and country. */
export function sitemapIndex(children: readonly string[]): string {
  const items = children.map((loc) => `<sitemap><loc>${escapeXml(loc)}</loc></sitemap>`)
  return `${HEAD}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items.join('')}</sitemapindex>\n`
}

export type SitemapEntry = {
  loc: string
  /** The same page in every language, by language code, for `hreflang`. */
  alternates: Readonly<Record<string, string>>
}

/** A child sitemap, with each page's other languages. */
export function urlset(entries: readonly SitemapEntry[]): string {
  const items = entries.map(({ loc, alternates }) => {
    const links = Object.entries(alternates).map(
      ([lang, href]) =>
        `<xhtml:link rel="alternate" hreflang="${escapeXml(lang)}" href="${escapeXml(href)}"/>`,
    )
    return `<url><loc>${escapeXml(loc)}</loc>${links.join('')}</url>`
  })
  return `${HEAD}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${items.join('')}</urlset>\n`
}

/** `/robots.txt`. A server kept out of search engines (section 16.1) disallows everything. */
export function robotsTxt(sitemap: string, noindex: boolean): string {
  if (noindex) return 'User-agent: *\nDisallow: /\n'
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${sitemap}\n`
}

export type FeedItem = {
  title: string
  link: string
  description: string | null
  /** An ISO date or date and time. */
  date: string | null
}

export type Feed = {
  title: string
  link: string
  self: string
  description: string
  language: string
  items: readonly FeedItem[]
}

const rfc822 = (date: string): string | null => {
  const time = Date.parse(date)
  return Number.isNaN(time) ? null : new Date(time).toUTCString()
}

/** A country's RSS 2.0 feed. */
export function rss(feed: Feed): string {
  const items = feed.items.map((item) => {
    const date = item.date ? rfc822(item.date) : null
    return [
      '<item>',
      `<title>${escapeXml(item.title)}</title>`,
      `<link>${escapeXml(item.link)}</link>`,
      `<guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
      item.description ? `<description>${escapeXml(item.description)}</description>` : '',
      date ? `<pubDate>${date}</pubDate>` : '',
      '</item>',
    ].join('')
  })
  return [
    HEAD,
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>',
    `<title>${escapeXml(feed.title)}</title>`,
    `<link>${escapeXml(feed.link)}</link>`,
    `<atom:link href="${escapeXml(feed.self)}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(feed.description)}</description>`,
    `<language>${escapeXml(feed.language)}</language>`,
    ...items,
    '</channel></rss>',
    '',
  ].join('\n')
}
