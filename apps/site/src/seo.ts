import type { SiteInfo } from '@promisetracker/contract'
import type { Metadata } from 'next'

/**
 * The address people reach the site at, without a trailing slash (section
 * 10.7). Canonical addresses, sitemaps, feeds and structured data need it
 * whole. Unset, the site falls back to its own port on localhost, which is
 * right for development and wrong anywhere else.
 */
export function publicOrigin(env: Readonly<Record<string, string | undefined>> = process.env) {
  const value = env.PT_PUBLIC_URL?.trim()
  if (value) {
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return url.origin + url.pathname.replace(/\/+$/, '')
      }
    } catch {
      // Not an address: fall through to the local one.
    }
  }
  return `http://localhost:${env.PORT?.trim() || '3000'}`
}

/** A site path made absolute: `/en/ke` gives `https://…/en/ke`. */
export const absolute = (path: string, origin = publicOrigin()): string => `${origin}${path}`

/**
 * The canonical address of a page and its address in every language the site
 * runs in (section 11.2: slugs are not translated, so only the language
 * changes). `path` has no language, such as `/ke/p/kibra-housing`, or `/` for
 * the home page. Search engines are sent to the default language for any
 * language they do not list.
 */
export function alternates(
  site: Pick<SiteInfo, 'locale' | 'defaultLanguage' | 'languages'>,
  path: string,
): NonNullable<Metadata['alternates']> {
  const at = (code: string) => (path === '/' ? `/${code}` : `/${code}${path}`)
  const languages: Record<string, string> = {}
  for (const language of site.languages) languages[language.code] = at(language.code)
  languages['x-default'] = at(site.defaultLanguage)
  return { canonical: at(site.locale), languages }
}

/** A JSON-LD script's body. `<` is escaped so a value cannot close the script. */
export const jsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, '\\u003c')
