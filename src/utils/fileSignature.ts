import { open } from "node:fs/promises";

/**
 * Magic-byte validation: confirms that a file's leading bytes match its
 * claimed MIME type (or extension) so a spoofed Content-Type / renamed file
 * cannot smuggle a different format into storage.
 */

const HEADER_LENGTH = 512;

type SignatureCheck = (header: Buffer) => boolean;

const startsWith =
  (bytes: number[], offset = 0): SignatureCheck =>
  (header) => {
    if (header.length < offset + bytes.length) {
      return false;
    }
    return bytes.every((byte, index) => header[offset + index] === byte);
  };

const isRiffWebp: SignatureCheck = (header) =>
  startsWith([0x52, 0x49, 0x46, 0x46])(header) &&
  startsWith([0x57, 0x45, 0x42, 0x50], 8)(header);

const JPEG = startsWith([0xff, 0xd8, 0xff]);
const PNG = startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF = (header: Buffer) =>
  startsWith([0x47, 0x49, 0x46, 0x38, 0x37, 0x61])(header) ||
  startsWith([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])(header);
const PDF = startsWith([0x25, 0x50, 0x44, 0x46]); // %PDF
const ZIP = (header: Buffer) =>
  startsWith([0x50, 0x4b, 0x03, 0x04])(header) ||
  startsWith([0x50, 0x4b, 0x05, 0x06])(header) ||
  startsWith([0x50, 0x4b, 0x07, 0x08])(header);
const OLE2 = startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const BINARY_SIGNATURES: SignatureCheck[] = [
  JPEG,
  PNG,
  GIF,
  isRiffWebp,
  PDF,
  ZIP,
  OLE2,
];

// Plain-text formats have no signature: accept them only when they contain
// no NUL bytes and do not start with a known binary signature.
const isPlausibleText: SignatureCheck = (header) => {
  if (header.length === 0) {
    return false;
  }
  if (BINARY_SIGNATURES.some((check) => check(header))) {
    return false;
  }
  return !header.includes(0);
};

const SIGNATURES_BY_MIME: Record<string, SignatureCheck> = {
  "image/jpeg": JPEG,
  "image/jpg": JPEG,
  "image/png": PNG,
  "image/gif": GIF,
  "image/webp": isRiffWebp,
  "application/pdf": PDF,
  "application/msword": OLE2,
  "application/vnd.ms-excel": OLE2,
  "application/vnd.ms-powerpoint": OLE2,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ZIP,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ZIP,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ZIP,
  "text/plain": isPlausibleText,
  "text/csv": isPlausibleText,
};

const SIGNATURES_BY_EXTENSION: Record<string, SignatureCheck> = {
  ".jpg": JPEG,
  ".jpeg": JPEG,
  ".png": PNG,
  ".gif": GIF,
  ".webp": isRiffWebp,
  ".pdf": PDF,
  ".doc": OLE2,
  ".xls": OLE2,
  ".ppt": OLE2,
  ".docx": ZIP,
  ".xlsx": ZIP,
  ".pptx": ZIP,
  ".txt": isPlausibleText,
  ".csv": isPlausibleText,
};

export type FileSignatureValidation =
  | { ok: true }
  | { ok: false; message: string };

export type FileSignatureClaim = {
  mimeType?: string | null;
  extension?: string | null;
};

export const validateBufferSignature = (
  header: Buffer,
  { mimeType, extension }: FileSignatureClaim,
): FileSignatureValidation => {
  const normalizedMime = (mimeType ?? "").trim().toLowerCase();
  const normalizedExtension = (extension ?? "").trim().toLowerCase();

  const check =
    SIGNATURES_BY_MIME[normalizedMime] ??
    SIGNATURES_BY_EXTENSION[normalizedExtension] ??
    null;

  if (!check) {
    // No signature registered for the claimed type; nothing to verify.
    return { ok: true };
  }

  if (!check(header)) {
    return {
      ok: false,
      message: `File content does not match the claimed type "${
        normalizedMime || normalizedExtension
      }"`,
    };
  }

  return { ok: true };
};

export const validateFileSignature = async (
  filePath: string,
  claim: FileSignatureClaim,
): Promise<FileSignatureValidation> => {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(HEADER_LENGTH);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_LENGTH, 0);
    return validateBufferSignature(buffer.subarray(0, bytesRead), claim);
  } finally {
    await handle.close();
  }
};
