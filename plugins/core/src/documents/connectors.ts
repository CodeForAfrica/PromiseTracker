import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { ContentExtractor, SourceConnector } from '@promisetracker/kernel'
import { ValidationError } from '@promisetracker/kernel'
import type { Payload } from 'payload'

import { downloadFile } from './download'
import type { PlaintextKind } from './plaintext'
import { readPlaintext } from './plaintext'

export const FILES = 'document-files'

/** A stored file's name and folder, as Payload saves them on the record. */
export type StoredFile = {
  filename?: string | null
  prefix?: string | null
  /** Where the file storage put it, when Payload recorded that. */
  _objectKey?: string | null
}

/** Reads a stored file's bytes. */
export type FileReader = (
  payload: Payload,
  collection: string,
  file: StoredFile,
) => Promise<Uint8Array>

/**
 * Where a stored file sits, relative to its storage: the record's prefix, the
 * object key Payload gives each stored version, then the file name. Either
 * folder may be empty.
 */
export function storedPath(file: StoredFile): string {
  if (!file.filename) throw new ValidationError('The record has no stored file.')
  return path.posix.join(file.prefix ?? '', file._objectKey ?? '', file.filename)
}

/**
 * Files stored in a local folder: the collection's own, as Payload sets it.
 * The app replaces this when files are stored in S3.
 */
export const readLocalFile: FileReader = async (payload, collection, file) => {
  // The plugin is built without the app's generated types, so the slug is a plain string.
  const collections = payload.collections as Record<
    string,
    { config: { upload?: { staticDir?: string } | boolean } } | undefined
  >
  const upload = collections[collection]?.config.upload
  const dir = typeof upload === 'object' ? upload.staticDir : undefined
  if (!dir) throw new ValidationError(`${collection} does not store files.`)
  const base = path.resolve(dir)
  const target = path.resolve(base, storedPath(file))
  // A name is Payload's, never a user's, but a path outside the folder is never read.
  if (!target.startsWith(base + path.sep)) throw new ValidationError('The file path is not valid.')
  return new Uint8Array(await readFile(target))
}

let fileReader: FileReader = readLocalFile

/** How stored files are read back: set by the app to match its file storage. */
export function setFileReader(next: FileReader): void {
  fileReader = next
}

export const readStoredFile: FileReader = (payload, collection, file) =>
  fileReader(payload, collection, file)

const healthy = async () => ({ healthy: true })

/**
 * Files an editor uploads (section 9.2). The upload stores the file, so
 * fetching it reads the stored file back. The item is the file's record id.
 */
export const uploadConnector: SourceConnector = {
  id: 'upload',
  mode: 'manual',
  health: healthy,
  fetch: async (item, ctx) => {
    // The pipeline runs as the system, for whoever uploaded the file.
    const doc = await ctx.payload.findByID({
      collection: FILES as 'users',
      id: item.id,
      depth: 0,
      overrideAccess: true,
    })
    const file = doc as unknown as StoredFile & { mimeType?: string | null }
    return {
      filename: file.filename ?? 'file',
      mimeType: file.mimeType ?? 'application/octet-stream',
      data: await readStoredFile(ctx.payload, FILES, file),
    }
  },
}

/**
 * Links an editor pastes (sections 9.2 and 13.4). The item is the link. The
 * server fetches it once, through the safeguards, and the file is stored.
 */
export const urlConnector: SourceConnector = {
  id: 'url',
  mode: 'manual',
  health: healthy,
  fetch: async (item, ctx) => {
    const download = await downloadFile(item.id, { signal: ctx.signal })
    return {
      filename: download.filename,
      mimeType: download.mimeType,
      data: download.data,
      sourceUrl: download.finalUrl,
    }
  },
}

const PLAINTEXT: readonly PlaintextKind[] = ['text/plain', 'text/markdown', 'text/csv', 'text/html']

/** Reads text, Markdown and HTML (section 9.3). Other formats come from plugin-tika. */
export const plaintextExtractor: ContentExtractor = {
  id: 'plaintext',
  accepts: PLAINTEXT,
  health: healthy,
  extract: async (content) => {
    const kind = PLAINTEXT.find((k) => k === content.mimeType)
    if (!kind) throw new ValidationError(`The plaintext extractor cannot read ${content.mimeType}.`)
    return { text: readPlaintext(content.data, kind), pageCount: null, metadata: {} }
  },
}
