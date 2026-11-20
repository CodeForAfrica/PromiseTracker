/** Where a statement sits in a document's text, for showing it in context (section 5.1). */
export type QuoteMatch = { before: string; quote: string; after: string }

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * Finds a statement in a document's text, ignoring differences in spacing and
 * case, and returns it with some text either side. Null when the statement is
 * not there, which a reviewer should know.
 */
export function findQuote(text: string, statement: string, context = 240): QuoteMatch | null {
  const body = squash(text)
  const quote = squash(statement)
  if (!body || !quote) return null
  // Matched in the text itself, without lowercasing it first: some letters,
  // such as İ, change length when lowercased, which would shift the highlight.
  const pattern = new RegExp(quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')
  const found = pattern.exec(body)
  if (!found) return null
  const at = found.index
  const length = found[0].length
  const start = Math.max(0, at - context)
  const end = Math.min(body.length, at + length + context)
  return {
    before: (start > 0 ? '…' : '') + body.slice(start, at),
    quote: body.slice(at, at + length),
    after: body.slice(at + length, end) + (end < body.length ? '…' : ''),
  }
}
