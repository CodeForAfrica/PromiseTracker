import type { AdapterContext, ContentExtractor, SourceContent } from '@promisetracker/kernel'
import { ConfigurationError, ExternalServiceError, ValidationError } from '@promisetracker/kernel'
import { normaliseText, SECRET_MASK } from '@promisetracker/plugin-core'

/**
 * Reads files through a self-hosted Apache Tika server (sections 6.2 and
 * 9.3). The pipeline gives each call its two-minute limit and a circuit
 * breaker. This only passes the request on and reads the answer.
 */

export const SERVICE = 'tika'

/** The formats plugin-tika reads. Text, Markdown, CSV and HTML stay with core's plaintext. */
export const TIKA_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'application/epub+zip',
] as const

/** A health check is cheap or it is down. */
export const HEALTH_TIMEOUT_MS = 5_000

/** The server's address from the plugin's settings, without a trailing slash. */
export function tikaUrl(settings: AdapterContext['settings']): string {
  const value = settings.url
  if (typeof value !== 'string' || !value.trim()) {
    throw new ConfigurationError(
      'Tika’s address is not set. A super-admin sets it in Administration > Settings > Tika.',
    )
  }
  // Settings read as a signed-in user come back masked. The kernel reads them
  // as the system, so this means a code path passed a person's request.
  if (value === SECRET_MASK) {
    throw new ConfigurationError(
      'Tika’s address was read as a person, so it is masked. Read the settings as the system.',
    )
  }
  let url = value.trim()
  while (url.endsWith('/')) url = url.slice(0, -1)
  return url
}

/** One item of Tika's /rmeta answer: the file, then anything embedded in it. */
type TikaItem = Readonly<Record<string, unknown>>

const pageCountOf = (item: TikaItem | undefined): number | null => {
  const raw = item?.['xmpTPg:NPages'] ?? item?.['meta:page-count']
  const count = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isInteger(count) && count > 0 ? count : null
}

/** Why Tika could not read the file, in words for the editor. */
function unreadable(exception: string): ValidationError {
  const locked = /encrypt|password/i.test(exception)
  return new ValidationError(
    locked
      ? 'The file is protected by a password, so it cannot be read. Upload a copy without one.'
      : 'Tika could not read the file. It may be damaged. Open it on a computer, save a new copy and upload that.',
  )
}

/** Reads Tika's answer: the text of the file and of what is embedded in it, in order. */
export function readTikaAnswer(items: unknown): {
  text: string
  pageCount: number | null
  metadata: Record<string, unknown>
} {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ExternalServiceError('tika answered with something other than a list of parts.', {
      service: SERVICE,
      failure: 'invalid-response',
    })
  }
  const parts = items as TikaItem[]
  const file = parts[0]
  const exception = file?.['X-TIKA:EXCEPTION:container_exception']
  const texts = parts
    .map((part) => part['X-TIKA:content'])
    .filter((text): text is string => typeof text === 'string')
  const text = normaliseText(texts.join('\n\n'))
  if (typeof exception === 'string' && !text) throw unreadable(exception)
  const contentType = file?.['Content-Type']
  return {
    text,
    pageCount: pageCountOf(file),
    metadata: {
      ...(typeof contentType === 'string' ? { contentType } : {}),
      parts: parts.length,
    },
  }
}

export const tikaExtractor: ContentExtractor = {
  id: 'tika',
  accepts: TIKA_TYPES,
  async health(ctx) {
    const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(HEALTH_TIMEOUT_MS)])
    try {
      const url = tikaUrl(ctx.settings)
      const response = await fetch(`${url}/version`, { signal })
      return response.ok
        ? { healthy: true, detail: (await response.text()).trim() }
        : { healthy: false, detail: `HTTP ${response.status}` }
    } catch (error) {
      if (error instanceof ConfigurationError) return { healthy: false, detail: error.message }
      return { healthy: false, detail: ExternalServiceError.fromCause(SERVICE, error).message }
    }
  },
  async extract(content: SourceContent, ctx) {
    const url = tikaUrl(ctx.settings)
    let response: Response
    try {
      // /rmeta/text answers with the text and the metadata, page count included, in one call.
      response = await fetch(`${url}/rmeta/text`, {
        method: 'PUT',
        headers: { 'Content-Type': content.mimeType, Accept: 'application/json' },
        // Files are read into ordinary ArrayBuffers, never shared ones, which fetch refuses.
        body: content.data as Uint8Array<ArrayBuffer>,
        signal: ctx.signal,
      })
    } catch (error) {
      throw ExternalServiceError.fromCause(SERVICE, error)
    }
    // 415 and 422: Tika does not read this type, or the file is broken. Trying again does not help.
    if (response.status === 415 || response.status === 422) throw unreadable(await response.text())
    if (!response.ok) throw ExternalServiceError.fromResponse(SERVICE, response)
    // Read the body, then parse it: a connection dropped part way through is
    // an outage worth trying again, and broken JSON is not.
    let body: string
    try {
      body = await response.text()
    } catch (error) {
      throw ExternalServiceError.fromCause(SERVICE, error)
    }
    let items: unknown
    try {
      items = JSON.parse(body)
    } catch (error) {
      throw new ExternalServiceError('tika answered with something other than JSON.', {
        service: SERVICE,
        failure: 'invalid-response',
        cause: error,
      })
    }
    return readTikaAnswer(items)
  },
}
