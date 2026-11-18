/** A site path in a language: `localePath('fr', '/ke')` is `/fr/ke`. */
export function localePath(locale: string, path = '/'): string {
  return path === '/' || path === '' ? `/${locale}` : `/${locale}${path}`
}

/** The path without its language: `/fr/ke` gives `/ke`. */
export function withoutLocale(pathname: string, locales: readonly string[]): string {
  const [, first, ...rest] = pathname.split('/')
  if (first && locales.includes(first)) return rest.length ? `/${rest.join('/')}` : '/'
  return pathname || '/'
}
