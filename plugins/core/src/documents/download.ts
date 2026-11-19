import { ExternalServiceError, ValidationError } from '@promisetracker/kernel'

import type { DocumentType } from './fileType'
import { checkFileType, DOCUMENT_TYPES, normaliseType } from './fileType'
import type { LookupFn } from './ssrf'
import { assertResolvesToPublicAddresses, assertSafeRemoteUrl } from './ssrf'

/**
 * Fetches a link for the link connector (sections 9.2 and 13.4), from v2's
 * `downloadFile` in `src/utils/files.ts`. Every redirect is checked like the
 * first link, with a limit on hops, a time limit per hop and in total, and a
 * size limit from the declared size and again while reading. The file is
 * kept in memory, because it is stored next.
 */

export const DOWNLOAD_LIMITS = Object.freeze({
  maxBytes: 100 * 1024 * 1024,
  maxRedirects: 3,
  /** To connect and receive headers, per hop. */
  responseTimeoutMs: 30_000,
  /** The whole download, reading included (section 9.7). */
  totalTimeoutMs: 5 * 60_000,
})

const REDIRECTS = new Set([301, 302, 303, 307, 308])
const SERVICE = 'url'

export type DownloadOptions = {
  maxBytes?: number
  maxRedirects?: number
  responseTimeoutMs?: number
  totalTimeoutMs?: number
  allowedHostnames?: readonly string[]
  signal?: AbortSignal
  /** For tests. */
  lookup?: LookupFn
}

export type Download = {
  filename: string
  mimeType: DocumentType
  data: Uint8Array
  /** Where the file came from after redirects. */
  finalUrl: string
}

/** A file name from the link's last path segment, with an extension for its type. */
export function filenameFor(url: URL, type: DocumentType): string {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '')
  const stem =
    last
      .replace(/\.[^.]*$/, '')
      .normalize('NFKD')
      // One dash for each run of other characters, dashes included, so at most
      // one is left at either end to trim.
      .replace(/[^a-zA-Z0-9_]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 100) || url.hostname.replace(/[^\w-]+/g, '-')
  const extension = EXTENSIONS[type]
  return `${stem}${extension}`
}

const EXTENSIONS: Record<DocumentType, string> = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.oasis.opendocument.text': '.odt',
  'application/vnd.oasis.opendocument.spreadsheet': '.ods',
  'application/vnd.oasis.opendocument.presentation': '.odp',
  'application/epub+zip': '.epub',
  'application/rtf': '.rtf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/html': '.html',
  'text/csv': '.csv',
}

const cancel = (res: Response) => res.body?.cancel().catch(() => {})

/** Fetches hop by hop, checking each address before it is reached. */
async function fetchChecked(
  first: URL,
  options: Required<Pick<DownloadOptions, 'maxRedirects' | 'responseTimeoutMs'>> &
    Pick<DownloadOptions, 'allowedHostnames' | 'lookup'> & { signal: AbortSignal },
): Promise<{ res: Response; url: URL }> {
  let url = first
  for (let hop = 0; hop <= options.maxRedirects; hop++) {
    // The allowlist says where a download may start. Every hop must be public HTTPS.
    assertSafeRemoteUrl(
      url,
      hop === 0 && options.allowedHostnames ? { allowedHostnames: options.allowedHostnames } : {},
    )
    await assertResolvesToPublicAddresses(url, options.lookup)
    let res: Response
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(options.responseTimeoutMs)]),
      })
    } catch (error) {
      throw ExternalServiceError.fromCause(SERVICE, error)
    }
    if (!REDIRECTS.has(res.status)) return { res, url }
    await cancel(res)
    const location = res.headers.get('location')
    if (!location) {
      throw new ExternalServiceError(`A redirect from ${url.host} has no Location header.`, {
        service: SERVICE,
        failure: 'invalid-response',
      })
    }
    if (hop === options.maxRedirects) {
      throw new ValidationError(
        `The link redirected more than the maximum of ${options.maxRedirects} redirects.`,
      )
    }
    url = new URL(location, url)
  }
  throw new Error('Redirects ran out unexpectedly.')
}

/** Downloads a link the connector may fetch, and checks the file's type. */
export async function downloadFile(link: string, options: DownloadOptions = {}): Promise<Download> {
  const maxBytes = options.maxBytes ?? DOWNLOAD_LIMITS.maxBytes
  const total = AbortSignal.timeout(options.totalTimeoutMs ?? DOWNLOAD_LIMITS.totalTimeoutMs)
  const signal = AbortSignal.any([options.signal, total].filter((s) => s !== undefined))

  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new ValidationError(`This is not a link: ${link}`)
  }

  const { res, url: finalUrl } = await fetchChecked(url, {
    maxRedirects: options.maxRedirects ?? DOWNLOAD_LIMITS.maxRedirects,
    responseTimeoutMs: options.responseTimeoutMs ?? DOWNLOAD_LIMITS.responseTimeoutMs,
    signal,
    ...(options.allowedHostnames ? { allowedHostnames: options.allowedHostnames } : {}),
    ...(options.lookup ? { lookup: options.lookup } : {}),
  })
  if (!res.ok) {
    await cancel(res)
    throw ExternalServiceError.fromResponse(SERVICE, res)
  }
  const declaredSize = Number(res.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    await cancel(res)
    throw new ValidationError(
      `The file is larger than the limit (${declaredSize} > ${maxBytes} bytes).`,
    )
  }
  const declared = normaliseType(res.headers.get('content-type'))
  if (!res.body) throw new ValidationError('The link returned no file.')

  const chunks: Uint8Array[] = []
  let size = 0
  const reader = res.body.getReader()
  // Reading stops when time runs out, even if the server stops sending.
  const stop = () => void reader.cancel(signal.reason).catch(() => {})
  signal.addEventListener('abort', stop, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (signal.aborted) throw signal.reason
      if (done) break
      size += value.length
      if (size > maxBytes) {
        throw new ValidationError(
          `The file is larger than the limit (more than ${maxBytes} bytes).`,
        )
      }
      chunks.push(value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof ValidationError) throw error
    throw ExternalServiceError.fromCause(SERVICE, total.aborted ? total.reason : error)
  } finally {
    signal.removeEventListener('abort', stop)
  }
  const data = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    data.set(chunk, offset)
    offset += chunk.length
  }

  // Name the file for its declared type, so the extension check compares like with like.
  const named = (DOCUMENT_TYPES as readonly string[]).includes(declared)
    ? filenameFor(finalUrl, declared as DocumentType)
    : decodeURIComponent(finalUrl.pathname.split('/').filter(Boolean).at(-1) ?? 'download')
  const mimeType = checkFileType({ filename: named, declaredType: declared, data })
  return { filename: filenameFor(finalUrl, mimeType), mimeType, data, finalUrl: finalUrl.href }
}
