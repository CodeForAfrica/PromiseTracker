import { Parser } from 'htmlparser2'

/**
 * Reads plain text, Markdown and HTML into text (section 9.3). Text comes out
 * in Unicode's composed form (NFC) with every character kept: version 2
 * removed accents, which damaged every French document.
 */

/**
 * The bytes as text. UTF-8 when they are valid UTF-8, otherwise Windows-1252,
 * which older French and English files use. Either way no character is lost.
 */
export function decodeText(data: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(data)
  } catch {
    return new TextDecoder('windows-1252').decode(data)
  }
}

/** Composed form, Unix line ends, no trailing spaces, at most one blank line in a row. */
export function normaliseText(text: string): string {
  return (
    text
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      // Line by line, not with a pattern: /[^\S\n]+$/gm takes quadratic time on a
      // long run of spaces that does not end its line.
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/** Page furniture and things that are not text. Everything inside is left out. */
const SKIPPED = new Set([
  'head',
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'math',
  'iframe',
  'object',
  'canvas',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  'button',
  'select',
  'dialog',
])

/** Elements that start a new line. */
const BLOCKS = new Set([
  'address',
  'article',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'tr',
  'ul',
])

/** Elements whose content is separated from its neighbours by a space, as table cells are. */
const CELLS = new Set(['td', 'th'])

/** The text of an HTML page, without its furniture: menus, headers, footers, scripts. */
export function htmlToText(html: string): string {
  let out = ''
  let skipping = 0
  let preformatted = 0
  const atLineStart = () => out === '' || out.endsWith('\n')
  const newline = () => {
    // Only the end is looked at: a pattern on the whole text would rescan it each time.
    let end = out.length
    while (end > 0 && out[end - 1] === ' ') end--
    out = `${out.slice(0, end)}\n`
  }
  /** Runs of spaces become one, and a line never starts with one. Preformatted text is kept. */
  const write = (text: string) => {
    if (preformatted) {
      out += text
      return
    }
    let collapsed = text.replace(/\s+/g, ' ')
    if (atLineStart() || out.endsWith(' ')) collapsed = collapsed.replace(/^ /, '')
    out += collapsed
  }
  const parser = new Parser(
    {
      onopentag(name) {
        if (SKIPPED.has(name)) skipping++
        if (skipping) return
        if (name === 'pre') preformatted++
        if (BLOCKS.has(name)) newline()
        if (name === 'p' || /^h[1-6]$/.test(name)) newline()
        if (name === 'li') out += '- '
        if (CELLS.has(name) && !atLineStart()) write(' ')
      },
      ontext(text) {
        if (!skipping) write(text)
      },
      onclosetag(name) {
        if (SKIPPED.has(name)) {
          skipping = Math.max(0, skipping - 1)
          return
        }
        if (skipping) return
        if (name === 'pre') preformatted = Math.max(0, preformatted - 1)
        if (BLOCKS.has(name)) newline()
        if (name === 'p' || /^h[1-6]$/.test(name)) newline()
      },
    },
    { decodeEntities: true, lowerCaseTags: true, recognizeSelfClosing: true },
  )
  parser.write(html)
  parser.end()
  return out
}

export type PlaintextKind = 'text/plain' | 'text/markdown' | 'text/csv' | 'text/html'

/** Reads a text file of one of the kinds the plaintext extractor accepts. */
export function readPlaintext(data: Uint8Array, kind: PlaintextKind): string {
  const text = decodeText(data)
  return normaliseText(kind === 'text/html' ? htmlToText(text) : text)
}
