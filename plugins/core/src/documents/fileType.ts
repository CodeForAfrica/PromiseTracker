import { ValidationError } from '@promisetracker/kernel'

/**
 * What kind of file a document is (sections 9.3 and 13.5). The first bytes
 * are checked, then the declared type, then the extension. If they disagree,
 * the file is refused with the reason. The signatures are v2's
 * `src/utils/fileSignature.ts`, and the type and extension pairs are from
 * v2's upload checks.
 */

const HEADER_LENGTH = 512

type Signature = (header: Uint8Array) => boolean

const startsWith =
  (bytes: readonly number[], offset = 0): Signature =>
  (header) =>
    header.length >= offset + bytes.length && bytes.every((b, i) => header[offset + i] === b)

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

const JPEG = startsWith([0xff, 0xd8, 0xff])
const PNG = startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const GIF: Signature = (h) => startsWith(ascii('GIF87a'))(h) || startsWith(ascii('GIF89a'))(h)
const WEBP: Signature = (h) => startsWith(ascii('RIFF'))(h) && startsWith(ascii('WEBP'), 8)(h)
const PDF = startsWith(ascii('%PDF'))
const ZIP: Signature = (h) =>
  startsWith([0x50, 0x4b, 0x03, 0x04])(h) ||
  startsWith([0x50, 0x4b, 0x05, 0x06])(h) ||
  startsWith([0x50, 0x4b, 0x07, 0x08])(h)
const OLE2 = startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const RTF = startsWith(ascii('{\\rtf'))

const BINARY: readonly Signature[] = [JPEG, PNG, GIF, WEBP, PDF, ZIP, OLE2]

/** Text has no signature: no NUL byte, and no binary signature at the start. */
const TEXT: Signature = (h) => h.length > 0 && !BINARY.some((s) => s(h)) && !h.includes(0)

const decoder = new TextDecoder('utf-8', { fatal: false })
const leadingText = (h: Uint8Array) => decoder.decode(h).replace(/^﻿/, '').trimStart().toLowerCase()

/** SVG can carry scripts, and nothing needs it (section 13.4). */
const looksLikeSvg = (h: Uint8Array) => {
  const text = leadingText(h)
  return text.startsWith('<svg') || (text.startsWith('<?xml') && text.includes('<svg'))
}

const looksLikeHtml = (h: Uint8Array) => {
  const text = leadingText(h)
  return text.startsWith('<!doctype html') || text.startsWith('<html')
}

/** The types a document may be, each with its signature and extensions. */
const KINDS = {
  'application/pdf': { signature: PDF, extensions: ['.pdf'] },
  'application/msword': { signature: OLE2, extensions: ['.doc'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    signature: ZIP,
    extensions: ['.docx'],
  },
  'application/vnd.ms-excel': { signature: OLE2, extensions: ['.xls'] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    signature: ZIP,
    extensions: ['.xlsx'],
  },
  'application/vnd.ms-powerpoint': { signature: OLE2, extensions: ['.ppt'] },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    signature: ZIP,
    extensions: ['.pptx'],
  },
  'application/vnd.oasis.opendocument.text': { signature: ZIP, extensions: ['.odt'] },
  'application/vnd.oasis.opendocument.spreadsheet': { signature: ZIP, extensions: ['.ods'] },
  'application/vnd.oasis.opendocument.presentation': { signature: ZIP, extensions: ['.odp'] },
  'application/epub+zip': { signature: ZIP, extensions: ['.epub'] },
  'application/rtf': { signature: RTF, extensions: ['.rtf'] },
  'text/plain': { signature: TEXT, extensions: ['.txt', '.text'] },
  'text/markdown': { signature: TEXT, extensions: ['.md', '.markdown'] },
  'text/html': { signature: TEXT, extensions: ['.html', '.htm'] },
  'text/csv': { signature: TEXT, extensions: ['.csv'] },
} as const satisfies Record<string, { signature: Signature; extensions: readonly string[] }>

export type DocumentType = keyof typeof KINDS

export const DOCUMENT_TYPES = Object.keys(KINDS) as DocumentType[]

/** Other names browsers and servers use for the same types. */
const ALIASES: Readonly<Record<string, DocumentType>> = {
  'application/csv': 'text/csv',
  'text/x-markdown': 'text/markdown',
  'application/xhtml+xml': 'text/html',
  'text/rtf': 'application/rtf',
}

const isDocumentType = (value: string): value is DocumentType => value in KINDS

/** A declared type without its parameters, in lower case, with aliases resolved. */
export const normaliseType = (value: string | null | undefined): string => {
  const type = (value ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  return ALIASES[type] ?? type
}

export const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot).toLowerCase()
}

const byExtension = (extension: string): DocumentType | null =>
  DOCUMENT_TYPES.find((t) => (KINDS[t].extensions as readonly string[]).includes(extension)) ?? null

/** Declared types that say nothing, so the extension decides. */
const UNDECLARED = new Set(['', 'application/octet-stream', 'binary/octet-stream'])

export type FileClaim = {
  filename: string
  /** The type the browser or server declared, if any. */
  declaredType?: string | null
  data: Uint8Array
}

/**
 * The file's type, once its first bytes, declared type and extension agree.
 * Throws a ValidationError saying why when they do not, or when the type is
 * not one a document can be.
 */
export function checkFileType({ filename, declaredType, data }: FileClaim): DocumentType {
  const header = data.subarray(0, HEADER_LENGTH)
  const extension = extensionOf(filename)
  const declared = normaliseType(declaredType)

  if (declared === 'image/svg+xml' || extension === '.svg' || looksLikeSvg(header)) {
    throw new ValidationError('SVG files are not accepted, because they can carry scripts.')
  }
  if (header.length === 0) throw new ValidationError('The file is empty.')

  const fromExtension = byExtension(extension)
  let type: DocumentType
  if (UNDECLARED.has(declared)) {
    if (!fromExtension) {
      throw new ValidationError(
        `The file has no declared type, and "${extension || 'no extension'}" is not a kind of document this system reads.`,
      )
    }
    type = fromExtension
  } else {
    if (!isDocumentType(declared)) {
      throw new ValidationError(`Files of type "${declared}" are not accepted as documents.`)
    }
    type = declared
  }

  // The first bytes come first: they are the only part a sender cannot simply type.
  if (!KINDS[type].signature(header)) {
    throw new ValidationError(
      `The file's content does not match its type: it is not a ${type} file.`,
    )
  }
  if (!fromExtension) {
    throw new ValidationError(
      `The extension "${extension || 'none'}" does not match the file's type, ${type}.`,
    )
  }
  if (fromExtension !== type) {
    // Text kinds share one signature, so a .txt that is really a web page reads as one.
    const text = KINDS[type].signature === TEXT && KINDS[fromExtension].signature === TEXT
    if (!(text && (declared === 'text/plain' || UNDECLARED.has(declared)))) {
      throw new ValidationError(
        `The extension "${extension}" does not match the declared type, ${type}.`,
      )
    }
    type = fromExtension
  }
  // A page served or saved as plain text is still read as a page.
  if (type === 'text/plain' && looksLikeHtml(header)) return 'text/html'
  return type
}

/** What a citizen may attach to a submission: photos and PDFs (section 13.5). */
const SUBMISSION_KINDS = {
  'image/jpeg': { signature: JPEG, extensions: ['.jpg', '.jpeg'] },
  'image/png': { signature: PNG, extensions: ['.png'] },
  'image/webp': { signature: WEBP, extensions: ['.webp'] },
  'application/pdf': { signature: PDF, extensions: ['.pdf'] },
} as const satisfies Record<string, { signature: Signature; extensions: readonly string[] }>

export type SubmissionFileType = keyof typeof SUBMISSION_KINDS

export const SUBMISSION_FILE_TYPES = Object.keys(SUBMISSION_KINDS) as SubmissionFileType[]

/**
 * A submission file's type, when its first bytes, declared type and extension
 * all name the same photo or PDF type. Null otherwise.
 */
export function submissionFileType({
  filename,
  declaredType,
  data,
}: FileClaim): SubmissionFileType | null {
  const header = data.subarray(0, HEADER_LENGTH)
  const extension = extensionOf(filename)
  const declared = normaliseType(declaredType)
  const match = SUBMISSION_FILE_TYPES.find((type) => SUBMISSION_KINDS[type].signature(header))
  if (!match) return null
  if (!(SUBMISSION_KINDS[match].extensions as readonly string[]).includes(extension)) return null
  if (!UNDECLARED.has(declared) && declared !== match) return null
  return match
}
