import { DEFAULT_LOCALE, getSite } from '@/data'
import { pickLocale } from '@/locale'

/** `/` sends the visitor to their preferred language, otherwise the default (section 11.2). */
export async function GET(request: Request) {
  const site = await getSite(DEFAULT_LOCALE)
  const locale = pickLocale(
    request.headers.get('accept-language'),
    site.languages.map((l) => l.code),
    site.defaultLanguage,
  )
  return new Response(null, {
    status: 307,
    headers: { Location: `/${locale}`, Vary: 'Accept-Language', 'Cache-Control': 'no-store' },
  })
}
