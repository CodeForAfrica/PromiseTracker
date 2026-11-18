/**
 * The visitor's preferred language among those the site runs in, from an
 * Accept-Language header, otherwise the default (section 11.2).
 */
export function pickLocale(
  header: string | null,
  available: readonly string[],
  fallback: string,
): string {
  if (!header) return fallback
  const wanted = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q ? Number(q.slice(2)) : 1
      return { tag: tag.toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    // Highest weight first. Equal weights keep the visitor's order.
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  for (const { tag } of wanted) {
    const [primary = ''] = tag.split('-')
    if (available.includes(tag)) return tag
    if (available.includes(primary)) return primary
  }
  return fallback
}
