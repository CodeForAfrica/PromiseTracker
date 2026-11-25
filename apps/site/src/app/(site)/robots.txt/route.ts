import { noindexFrom } from '@/noindex'
import { absolute } from '@/seo'
import { robotsTxt } from '@/xml'

/** `/robots.txt` (section 11.3). Read at request time, as PT_NOINDEX is (section 16.1). */
export function GET() {
  return new Response(robotsTxt(absolute('/sitemap.xml'), noindexFrom(process.env.PT_NOINDEX)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export const dynamic = 'force-dynamic'
