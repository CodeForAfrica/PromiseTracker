import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { ExternalServiceError, ValidationError } from '@promisetracker/kernel'
import {
  assertResolvesToPublicAddresses,
  assertSafeRemoteUrl,
  checkFileType,
  decodeText,
  downloadFile,
  extractorFor,
  FILES,
  filenameFor,
  htmlToText,
  isBlockedIpAddress,
  isHostnameAllowed,
  MAX_RUNS,
  NEXT_RUN_MS,
  normaliseType,
  outcomeOf,
  parseHostnameAllowlist,
  plaintextExtractor,
  readLocalFile,
  readPlaintext,
  readStoredFile,
  setFileReader,
  storedPath,
  uploadConnector,
  urlConnector,
} from '@promisetracker/plugin-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The document pipeline's pure parts: the link connector's safeguards
 * (section 13.4), the file type check (sections 9.3 and 13.5), reading text,
 * and what happens after a failure (section 9.7). The SSRF, signature and
 * download cases are v2's tests, carried over.
 */

const bytes = (...values: number[]) => new Uint8Array(values)
const text = (value: string) => new TextEncoder().encode(value)
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2)
const PDF = text('%PDF-1.7 rest of file')
const DOCX = bytes(0x50, 0x4b, 0x03, 0x04, 1, 2)
const DOC = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 1)
const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

describe('isBlockedIpAddress (v2)', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '127.255.255.255',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1',
    '192.168.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    'fe80::1',
    'fe80::1%eth0',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '2001:db8::1',
    '2002:7f00:0001::',
    '[::1]',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(true)
  })

  it.each([
    '93.184.216.34',
    '8.8.8.8',
    '196.216.167.10',
    '172.32.0.1',
    '2606:4700::6810:85e5',
    '2a00:1450:4009:81f::200e',
    '2002:5db8:d822::',
  ])('allows public address %s', (ip) => {
    expect(isBlockedIpAddress(ip)).toBe(false)
  })
})

describe('isHostnameAllowed (v2)', () => {
  it('matches exact hostnames case-insensitively', () => {
    expect(isHostnameAllowed('Assets.CheckMedia.org', ['assets.checkmedia.org'])).toBe(true)
    expect(isHostnameAllowed('assets.checkmedia.org', ['checkmedia.org'])).toBe(false)
    expect(isHostnameAllowed('checkmedia.org', [' ', ''])).toBe(false)
  })

  it('matches wildcard suffixes including the apex', () => {
    expect(isHostnameAllowed('assets.checkmedia.org', ['*.checkmedia.org'])).toBe(true)
    expect(isHostnameAllowed('checkmedia.org', ['*.checkmedia.org'])).toBe(true)
    expect(isHostnameAllowed('evilcheckmedia.org', ['*.checkmedia.org'])).toBe(false)
    expect(isHostnameAllowed('checkmedia.org.evil.com', ['*.checkmedia.org'])).toBe(false)
  })
})

describe('assertSafeRemoteUrl (v2)', () => {
  it('requires HTTPS by default', () => {
    expect(() => assertSafeRemoteUrl(new URL('http://example.com/file'))).toThrow(/non-HTTPS/)
    expect(() =>
      assertSafeRemoteUrl(new URL('ftp://example.com/file'), { requireHttps: false }),
    ).toThrow(/non-HTTP\(S\)/)
    expect(() =>
      assertSafeRemoteUrl(new URL('http://example.com/file'), { requireHttps: false }),
    ).not.toThrow()
  })

  it('rejects blocked IP literals and embedded credentials', () => {
    expect(() => assertSafeRemoteUrl(new URL('https://169.254.169.254/creds'))).toThrow(
      /blocked address/,
    )
    expect(() => assertSafeRemoteUrl(new URL('https://u:p@example.com/'))).toThrow(
      /embedded credentials/,
    )
  })

  it('enforces the allowlist when provided', () => {
    expect(() =>
      assertSafeRemoteUrl(new URL('https://example.com/file'), {
        allowedHostnames: ['*.checkmedia.org'],
      }),
    ).toThrow(/allowlist/)
    expect(() =>
      assertSafeRemoteUrl(new URL('https://assets.checkmedia.org/img.png'), {
        allowedHostnames: ['*.checkmedia.org'],
      }),
    ).not.toThrow()
  })

  it('is never retried', () => {
    try {
      assertSafeRemoteUrl(new URL('http://example.com'))
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).retryable).toBe(false)
    }
  })
})

describe('assertResolvesToPublicAddresses (v2)', () => {
  it('accepts hosts resolving only to public addresses', async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL('https://example.com'), async () => [
        { address: '93.184.216.34', family: 4 },
      ]),
    ).resolves.toBeUndefined()
    await expect(
      assertResolvesToPublicAddresses(new URL('https://example.com'), async () => ({
        address: '93.184.216.34',
        family: 4,
      })),
    ).resolves.toBeUndefined()
  })

  it('rejects hosts resolving to any blocked address', async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL('https://example.com'), async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow(/blocked address/)
  })

  it('checks IP literals without a lookup', async () => {
    const lookup = vi.fn()
    await expect(
      assertResolvesToPublicAddresses(new URL('https://10.0.0.1'), lookup),
    ).rejects.toThrow(/blocked address/)
    await expect(
      assertResolvesToPublicAddresses(new URL('https://8.8.8.8'), lookup),
    ).resolves.toBeUndefined()
    expect(lookup).not.toHaveBeenCalled()
  })

  it('rejects hosts that fail to resolve, or resolve to nothing', async () => {
    await expect(
      assertResolvesToPublicAddresses(new URL('https://example.com'), async () => {
        throw new Error('ENOTFOUND')
      }),
    ).rejects.toThrow(/Failed to resolve/)
    await expect(
      assertResolvesToPublicAddresses(new URL('https://example.com'), async () => []),
    ).rejects.toThrow(/did not resolve/)
  })
})

describe('parseHostnameAllowlist (v2)', () => {
  it('splits and trims comma-separated entries', () => {
    expect(parseHostnameAllowlist(' a.com , *.b.org ,, ')).toEqual(['a.com', '*.b.org'])
    expect(parseHostnameAllowlist(undefined)).toEqual([])
  })
})

describe('checkFileType: first bytes, then declared type, then extension', () => {
  it.each([
    ['report.pdf', 'application/pdf', PDF],
    ['report.docx', WORD, DOCX],
    ['report.doc', 'application/msword', DOC],
    ['notes.txt', 'text/plain', text('just some text')],
    ['data.csv', 'text/csv', text('a,b,c\n1,2,3')],
    ['data.csv', 'application/csv', text('a,b\n1,2')],
    ['readme.md', 'text/markdown', text('# Title')],
    ['page.html', 'text/html', text('<p>Hi</p>')],
    ['letter.rtf', 'application/rtf', text('{\\rtf1 hello}')],
  ])('accepts a genuine %s', (filename, declaredType, data) => {
    expect(checkFileType({ filename, declaredType, data })).toBe(normaliseType(declaredType))
  })

  it.each([
    ['pdf claimed but zip bytes', 'report.pdf', 'application/pdf', DOCX],
    ['pdf claimed but HTML', 'report.pdf', 'application/pdf', text('<html></html>')],
    ['text claimed but binary', 'a.txt', 'text/plain', bytes(0x00, 0x01, 0x02)],
    ['text claimed but PDF bytes', 'a.csv', 'text/csv', PDF],
    ['Word claimed but a picture', 'a.docx', WORD, JPEG],
  ])('rejects %s', (_label, filename, declaredType, data) => {
    expect(() => checkFileType({ filename, declaredType, data })).toThrow(/does not match its type/)
  })

  it('rejects an extension that disagrees with the declared type', () => {
    expect(() =>
      checkFileType({ filename: 'report.exe', declaredType: 'application/pdf', data: PDF }),
    ).toThrow(/extension ".exe" does not match/)
    expect(() =>
      checkFileType({ filename: 'report', declaredType: 'application/pdf', data: PDF }),
    ).toThrow(/extension "none"/)
    expect(() =>
      checkFileType({ filename: 'report.docx', declaredType: 'application/pdf', data: PDF }),
    ).toThrow(/does not match the declared type/)
  })

  it('falls back to the extension when no type is declared', () => {
    expect(checkFileType({ filename: 'a.pdf', declaredType: null, data: PDF })).toBe(
      'application/pdf',
    )
    expect(
      checkFileType({ filename: 'a.pdf', declaredType: 'application/octet-stream', data: PDF }),
    ).toBe('application/pdf')
    expect(() => checkFileType({ filename: 'a.pdf', data: text('nope') })).toThrow(/does not match/)
    expect(() => checkFileType({ filename: 'a.exe', data: PDF })).toThrow(/no declared type/)
  })

  it('refuses SVG however it arrives', () => {
    const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')
    expect(() => checkFileType({ filename: 'a.svg', data: svg })).toThrow(/SVG/)
    expect(() =>
      checkFileType({ filename: 'a.txt', declaredType: 'image/svg+xml', data: svg }),
    ).toThrow(/SVG/)
    expect(() =>
      checkFileType({ filename: 'a.txt', declaredType: 'text/plain', data: svg }),
    ).toThrow(/SVG/)
    expect(() =>
      checkFileType({ filename: 'a.html', declaredType: 'text/html', data: text('<?xml?><svg/>') }),
    ).toThrow(/SVG/)
  })

  it('refuses empty files, pictures and other kinds a document cannot be', () => {
    expect(() =>
      checkFileType({ filename: 'a.txt', declaredType: 'text/plain', data: new Uint8Array() }),
    ).toThrow(/empty/)
    expect(() =>
      checkFileType({ filename: 'a.png', declaredType: 'image/png', data: PNG }),
    ).toThrow(/not accepted/)
  })

  it('reads text kinds by their extension, and a page saved as text as a page', () => {
    expect(
      checkFileType({ filename: 'a.html', declaredType: 'text/plain', data: text('<p>x</p>') }),
    ).toBe('text/html')
    expect(checkFileType({ filename: 'a.md', declaredType: 'text/plain', data: text('# x') })).toBe(
      'text/markdown',
    )
    expect(
      checkFileType({
        filename: 'a.txt',
        declaredType: 'text/plain',
        data: text('﻿<!DOCTYPE html><html></html>'),
      }),
    ).toBe('text/html')
    expect(() =>
      checkFileType({ filename: 'a.txt', declaredType: 'text/html', data: text('<p>x</p>') }),
    ).toThrow(/does not match the declared type/)
  })

  it('normalises declared types', () => {
    expect(normaliseType('Text/HTML; charset=utf-8')).toBe('text/html')
    expect(normaliseType('text/x-markdown')).toBe('text/markdown')
    expect(normaliseType(undefined)).toBe('')
  })
})

describe('reading text (section 9.3)', () => {
  const french =
    'Le gouvernement s’engage à créer 500 000 emplois d’ici à 2027 : écoles, hôpitaux, Côte d’Ivoire, Œuvre, ça.'

  it('keeps every accented character, in composed form', () => {
    // "é" written as e and a combining accent comes out as the one character.
    const decomposed = french.normalize('NFD')
    expect(decomposed).not.toBe(french)
    const out = readPlaintext(text(decomposed), 'text/plain')
    expect(out).toBe(french)
    expect(out).toContain('créer')
    expect(out).toContain('Œuvre')
    expect([...out].length).toBe([...french].length)
  })

  it('reads Windows-1252 files without losing accents', () => {
    // "été" in Windows-1252: é is 0xE9.
    expect(decodeText(bytes(0xe9, 0x74, 0xe9))).toBe('été')
    expect(decodeText(text('﻿bonjour'))).toBe('bonjour')
  })

  it('reads HTML without its menus, headers, footers and scripts', () => {
    const html = `<!doctype html><html><head><title>T</title><style>p{}</style></head><body>
      <header>Site name</header><nav><a>Home</a></nav>
      <main><h1>Engagements</h1><p>Nous allons  bâtir   des routes.</p>
      <ul><li>Écoles</li><li>Santé &amp; eau</li></ul>
      <table><tr><td>A</td><td>B</td></tr></table>
      <pre>  kept   as is</pre></main>
      <aside>Related</aside><footer>© 2026</footer><script>alert(1)</script></body></html>`
    const out = readPlaintext(text(html), 'text/html')
    expect(out).toContain('Engagements')
    expect(out).toContain('Nous allons bâtir des routes.')
    expect(out).toContain('- Écoles')
    expect(out).toContain('- Santé & eau')
    expect(out).toContain('A B')
    expect(out).toContain('  kept   as is')
    for (const furniture of ['Site name', 'Home', 'Related', '© 2026', 'alert', 'p{}', 'T\n']) {
      expect(out).not.toContain(furniture)
    }
  })

  it('separates blocks and limits blank lines', () => {
    expect(htmlToText('<p>One</p><p>Two</p>').trim()).toMatch(/One\n+Two/)
    expect(readPlaintext(text('a\r\n\r\n\r\n\r\nb  \n'), 'text/plain')).toBe('a\n\nb')
  })

  it('is what the plaintext extractor returns, for the kinds it accepts', async () => {
    const ctx = {} as never
    const result = await plaintextExtractor.extract(
      { filename: 'a.md', mimeType: 'text/markdown', data: text('# Été') },
      ctx,
    )
    expect(result).toEqual({ text: '# Été', pageCount: null, metadata: {} })
    await expect(
      plaintextExtractor.extract(
        { filename: 'a.pdf', mimeType: 'application/pdf', data: PDF },
        ctx,
      ),
    ).rejects.toThrow(/cannot read/)
    await expect(plaintextExtractor.health(ctx)).resolves.toEqual({ healthy: true })
  })
})

describe('choosing an extractor', () => {
  const make = (id: string, accepts: string[]) => ({
    id,
    accepts,
    health: async () => ({ healthy: true }),
    extract: async () => ({ text: '', pageCount: null, metadata: {} }),
  })

  it('takes the most specific match', () => {
    const anyText = make('any', ['text/*'])
    const html = make('html', ['text/html'])
    expect(extractorFor([anyText, html], 'text/html')?.id).toBe('html')
    expect(extractorFor([anyText, html], 'text/plain')?.id).toBe('any')
    expect(extractorFor([html], 'application/pdf')).toBeNull()
  })
})

describe('after a failure (section 9.7)', () => {
  const outage = new ExternalServiceError('down', { service: 'url', failure: 'unavailable' })

  it('fails invalid data and rejected keys at once', () => {
    expect(outcomeOf(new ValidationError('bad'), 1)).toEqual({ retry: false })
    expect(
      outcomeOf(new ExternalServiceError('no', { service: 'url', failure: 'unauthorized' }), 1),
    ).toEqual({ retry: false })
    expect(outcomeOf(new Error('a bug'), 1)).toEqual({ retry: false })
  })

  it('runs again later when a service is down, waiting longer each time, up to the limit', () => {
    expect(outcomeOf(outage, 1)).toEqual({ retry: true, waitMs: NEXT_RUN_MS })
    expect(outcomeOf(outage, 2)).toEqual({ retry: true, waitMs: 2 * NEXT_RUN_MS })
    expect(outcomeOf(outage, MAX_RUNS)).toEqual({ retry: false })
  })

  it('waits as long as a busy service asks', () => {
    const busy = new ExternalServiceError('busy', {
      service: 'url',
      failure: 'rate-limited',
      retryAfterMs: 120_000,
    })
    expect(outcomeOf(busy, 1)).toEqual({ retry: true, waitMs: 120_000 })
  })
})

describe('downloadFile (v2)', () => {
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }]

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const serve = (body: BodyInit | null, init: ResponseInit = {}) =>
    vi.fn(async () => new Response(body, init))

  it('fetches the file and names it for its type', async () => {
    vi.stubGlobal(
      'fetch',
      serve('downloaded content', { headers: { 'content-type': 'text/plain' } }),
    )
    const file = await downloadFile('https://example.com/Ruto%20Manifesto%202022', { lookup })
    expect(new TextDecoder().decode(file.data)).toBe('downloaded content')
    expect(file).toMatchObject({
      filename: 'ruto-manifesto-2022.txt',
      mimeType: 'text/plain',
      finalUrl: 'https://example.com/Ruto%20Manifesto%202022',
    })
  })

  it('names files safely', () => {
    expect(filenameFor(new URL('https://example.com/../../etc/passwd'), 'text/plain')).toBe(
      'passwd.txt',
    )
    expect(filenameFor(new URL('https://example.com/'), 'application/pdf')).toBe('example-com.pdf')
  })

  it('rejects downloads that exceed the size limit, declared or read', async () => {
    vi.stubGlobal(
      'fetch',
      serve('x'.repeat(64), { headers: { 'content-type': 'text/plain', 'content-length': '64' } }),
    )
    await expect(
      downloadFile('https://example.com/file.txt', { maxBytes: 16, lookup }),
    ).rejects.toThrow(/larger than the limit \(64 > 16/)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const res = new Response('x'.repeat(64), { headers: { 'content-type': 'text/plain' } })
        res.headers.delete('content-length')
        return res
      }),
    )
    await expect(
      downloadFile('https://example.com/file.txt', { maxBytes: 16, lookup }),
    ).rejects.toThrow(/more than 16 bytes/)
  })

  it('rejects links that are not links', async () => {
    await expect(downloadFile('not a link', { lookup })).rejects.toThrow(/not a link/)
  })

  describe('SSRF protections', () => {
    it('rejects plain HTTP and embedded credentials before fetching', async () => {
      const fetchMock = serve('content')
      vi.stubGlobal('fetch', fetchMock)
      await expect(downloadFile('http://example.com/file.txt', { lookup })).rejects.toThrow(
        /non-HTTPS/,
      )
      await expect(
        downloadFile('https://user:pass@example.com/file.txt', { lookup }),
      ).rejects.toThrow(/embedded credentials/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each([
      ['loopback', 'https://127.0.0.1/file'],
      ['private 10/8', 'https://10.0.0.8/file'],
      ['private 192.168/16', 'https://192.168.1.10/file'],
      ['cloud metadata', 'https://169.254.169.254/latest/meta-data/'],
      ['IPv6 loopback', 'https://[::1]/file'],
      ['IPv4-mapped IPv6', 'https://[::ffff:127.0.0.1]/file'],
    ])('rejects %s IP-literal links', async (_label, url) => {
      const fetchMock = serve('content')
      vi.stubGlobal('fetch', fetchMock)
      await expect(downloadFile(url, { lookup })).rejects.toThrow(/blocked address/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects hostnames where any resolved address is blocked', async () => {
      const fetchMock = serve('content')
      vi.stubGlobal('fetch', fetchMock)
      await expect(
        downloadFile('https://dual.example.com/file', {
          lookup: async () => [
            { address: '93.184.216.34', family: 4 },
            { address: '169.254.169.254', family: 4 },
          ],
        }),
      ).rejects.toThrow(/blocked address/)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects redirects that land on private addresses', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { location: 'https://10.0.0.5/internal' } }),
        )
      vi.stubGlobal('fetch', fetchMock)
      await expect(downloadFile('https://example.com/file', { lookup })).rejects.toThrow(
        /blocked address/,
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('rejects redirects that downgrade to HTTP, or have nowhere to go', async () => {
      vi.stubGlobal(
        'fetch',
        serve(null, { status: 301, headers: { location: 'http://example.com/file' } }),
      )
      await expect(downloadFile('https://example.com/file', { lookup })).rejects.toThrow(
        /non-HTTPS/,
      )
      vi.stubGlobal('fetch', serve(null, { status: 302 }))
      await expect(downloadFile('https://example.com/file', { lookup })).rejects.toThrow(
        /no Location/,
      )
    })

    it('bounds the number of redirects', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async (url: URL) => new Response(null, { status: 302, headers: { location: `${url}x` } }),
        ),
      )
      await expect(
        downloadFile('https://example.com/file', { maxRedirects: 2, lookup }),
      ).rejects.toThrow(/maximum of 2 redirects/)
    })

    it('follows safe redirects to completion', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(null, {
            status: 302,
            headers: { location: 'https://cdn.example.com/file.txt' },
          }),
        )
        .mockResolvedValueOnce(
          new Response('redirected content', { headers: { 'content-type': 'text/plain' } }),
        )
      vi.stubGlobal('fetch', fetchMock)
      const file = await downloadFile('https://example.com/file.txt', { lookup })
      expect(new TextDecoder().decode(file.data)).toBe('redirected content')
      expect(file.finalUrl).toBe('https://cdn.example.com/file.txt')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('applies the hostname allowlist to the first link only', async () => {
      const fetchMock = serve('content', { headers: { 'content-type': 'text/plain' } })
      vi.stubGlobal('fetch', fetchMock)
      await expect(
        downloadFile('https://evil.example.com/file', {
          allowedHostnames: ['*.checkmedia.org'],
          lookup,
        }),
      ).rejects.toThrow(/not in the configured allowlist/)
      expect(fetchMock).not.toHaveBeenCalled()
      const file = await downloadFile('https://assets.checkmedia.org/file.txt', {
        allowedHostnames: ['*.checkmedia.org'],
        lookup,
      })
      expect(new TextDecoder().decode(file.data)).toBe('content')
    })
  })

  describe('content and failures', () => {
    it('rejects downloads whose bytes do not match the content type', async () => {
      vi.stubGlobal(
        'fetch',
        serve('<html>not a pdf</html>', { headers: { 'content-type': 'application/pdf' } }),
      )
      await expect(downloadFile('https://example.com/spoofed.pdf', { lookup })).rejects.toThrow(
        /does not match its type/,
      )
    })

    it('accepts downloads whose bytes match the content type', async () => {
      vi.stubGlobal(
        'fetch',
        serve(concat(PDF), { headers: { 'content-type': 'application/pdf; charset=binary' } }),
      )
      const file = await downloadFile('https://example.com/real', { lookup })
      expect(file).toMatchObject({ filename: 'real.pdf', mimeType: 'application/pdf' })
    })

    it('rejects types a document cannot be', async () => {
      vi.stubGlobal('fetch', serve(concat(PNG), { headers: { 'content-type': 'image/png' } }))
      await expect(downloadFile('https://example.com/a.png', { lookup })).rejects.toThrow(
        /not accepted/,
      )
    })

    it('turns HTTP errors into retryable or final service errors', async () => {
      vi.stubGlobal('fetch', serve('busy', { status: 503 }))
      const down = await downloadFile('https://example.com/a', { lookup }).catch((e: unknown) => e)
      expect(down).toBeInstanceOf(ExternalServiceError)
      expect((down as ExternalServiceError).retryable).toBe(true)
      vi.stubGlobal('fetch', serve('gone', { status: 404 }))
      const gone = await downloadFile('https://example.com/a', { lookup }).catch((e: unknown) => e)
      expect((gone as ExternalServiceError).retryable).toBe(false)
      vi.stubGlobal('fetch', serve('slow', { status: 429, headers: { 'retry-after': '120' } }))
      const busy = await downloadFile('https://example.com/a', { lookup }).catch((e: unknown) => e)
      expect((busy as ExternalServiceError).retryAfterMs).toBe(120_000)
    })

    it('turns a dropped connection into a retryable error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('fetch failed')
        }),
      )
      const error = await downloadFile('https://example.com/a', { lookup }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ExternalServiceError)
      expect((error as ExternalServiceError).failure).toBe('unavailable')
    })

    it('times out a download that takes too long', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.enqueue(text('partial'))
                },
              }),
              { headers: { 'content-type': 'text/plain' } },
            ),
        ),
      )
      const error = await downloadFile('https://example.com/a.txt', {
        lookup,
        totalTimeoutMs: 50,
      }).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ExternalServiceError)
      expect((error as ExternalServiceError).failure).toBe('timeout')
    })
  })
})

describe('reading stored files', () => {
  const dirs: string[] = []

  afterEach(async () => {
    setFileReader(readLocalFile)
    vi.unstubAllGlobals()
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
  })

  /** A Payload with one upload collection stored in a temporary folder. */
  const fakePayload = async (doc: Record<string, unknown> = {}) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pt-files-'))
    dirs.push(dir)
    const payload = {
      collections: {
        'document-files': { config: { upload: { staticDir: dir } } },
        media: { config: { upload: true } },
      },
      findByID: vi.fn(async () => doc),
    }
    return { dir, payload: payload as never }
  }

  it('finds a file under its prefix and object key', () => {
    expect(storedPath({ filename: 'a.pdf' })).toBe('a.pdf')
    expect(storedPath({ filename: 'a.pdf', prefix: 'docs', _objectKey: 'k1' })).toBe(
      'docs/k1/a.pdf',
    )
    expect(() => storedPath({ filename: null })).toThrow(/no stored file/)
  })

  it('reads a file from the collection’s folder, and nothing outside it', async () => {
    const { dir, payload } = await fakePayload()
    await mkdir(path.join(dir, 'k1'), { recursive: true })
    await writeFile(path.join(dir, 'k1', 'a.txt'), 'Été')
    const data = await readStoredFile(payload, 'document-files', {
      filename: 'a.txt',
      _objectKey: 'k1',
    })
    expect(new TextDecoder().decode(data)).toBe('Été')
    await expect(
      readStoredFile(payload, 'document-files', { filename: '../../etc/passwd' }),
    ).rejects.toThrow(/not valid/)
    await expect(readStoredFile(payload, 'media', { filename: 'a.txt' })).rejects.toThrow(
      /does not store files/,
    )
  })

  it('uses the reader the app sets, for S3', async () => {
    const { payload } = await fakePayload()
    setFileReader(async () => text('from S3'))
    expect(new TextDecoder().decode(await readStoredFile(payload, FILES, { filename: 'x' }))).toBe(
      'from S3',
    )
  })

  it('brings an uploaded file in by reading it back', async () => {
    const { dir, payload } = await fakePayload({ filename: 'b.md', mimeType: 'text/markdown' })
    await writeFile(path.join(dir, 'b.md'), '# B')
    const ctx = { payload, signal: new AbortController().signal } as never
    const content = await uploadConnector.fetch({ id: 'file-1' }, ctx)
    expect(content).toMatchObject({ filename: 'b.md', mimeType: 'text/markdown' })
    expect(new TextDecoder().decode(content.data)).toBe('# B')
    await expect(uploadConnector.health(ctx)).resolves.toEqual({ healthy: true })
  })

  it('names unknown fields safely when a record lacks them', async () => {
    const { payload } = await fakePayload({})
    setFileReader(async () => text('x'))
    const ctx = { payload, signal: new AbortController().signal } as never
    expect(await uploadConnector.fetch({ id: 'file-2' }, ctx)).toMatchObject({
      filename: 'file',
      mimeType: 'application/octet-stream',
    })
  })

  it('brings a link in through the safeguards', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Bonjour', { headers: { 'content-type': 'text/plain' } })),
    )
    const ctx = { signal: new AbortController().signal } as never
    // An IP address needs no lookup, so the test never reaches DNS.
    const content = await urlConnector.fetch({ id: 'https://93.184.216.34/salut' }, ctx)
    expect(content).toMatchObject({
      filename: 'salut.txt',
      mimeType: 'text/plain',
      sourceUrl: 'https://93.184.216.34/salut',
    })
    await expect(urlConnector.fetch({ id: 'http://93.184.216.34/' }, ctx)).rejects.toThrow(
      /non-HTTPS/,
    )
    await expect(urlConnector.health(ctx)).resolves.toEqual({ healthy: true })
  })
})
