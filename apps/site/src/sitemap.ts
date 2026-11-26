import type { PageSummary, ThemeSummary } from '@promisetracker/contract'

/**
 * The editorial pages a language's sitemap lists (sections 7.7 and 11.3):
 * each theme, and each editor page that is the site's own. A page that is a
 * marked link to a sister site leads away, so it is left out.
 */
export function editorialPaths(
  themes: readonly Pick<ThemeSummary, 'slug'>[],
  pages: readonly Pick<PageSummary, 'path' | 'link'>[],
): string[] {
  return [
    ...themes.map((theme) => `/themes/${theme.slug}`),
    ...pages.filter((page) => !page.link).map((page) => `/${page.path}`),
  ]
}

/** A country's articles, as its sitemap lists them. */
export const articlePaths = (code: string, slugs: readonly string[]): string[] =>
  slugs.map((slug) => `/${code}/a/${slug}`)
