import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, unlink } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export const mimeToExtension: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/csv": ".csv",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "application/json": ".json",
  "application/xml": ".xml",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
  "application/gzip": ".gz",
  "audio/mpeg": ".mp3",
  "video/mp4": ".mp4",
  "video/mpeg": ".mpeg",
};

const fileName = fileURLToPath(import.meta.url);
const dirName = dirname(fileName);
const tempDir = join(dirName, "..", "..", "temp");

const DEFAULT_MAX_DOWNLOAD_BYTES =
  Number(process.env.MAX_DOWNLOAD_BYTES) || 1024 * 1024 * 1024;

type DownloadFileOptions = {
  allowedMimeTypes?: string[];
  maxBytes?: number;
  fileName?: string;
};

const MAX_FILE_NAME_LENGTH = 100;

// Names come from Airtable and are user-controlled; strip anything that is
// not a word character so they are safe to use as a filesystem path segment.
const sanitizeFileName = (value: string): string =>
  value
    .trim()
    .replace(/ /g, "-")
    .replace(/[^\w-]+/g, "")
    .toLowerCase()
    .slice(0, MAX_FILE_NAME_LENGTH);

export const removeDownloadedFile = async (
  filePath: string,
): Promise<void> => {
  const parent = dirname(filePath);
  // Named downloads live in their own subdirectory of tempDir — remove the
  // whole directory so empty per-download folders do not accumulate.
  if (parent !== tempDir && parent.startsWith(tempDir + sep)) {
    await rm(parent, { recursive: true, force: true });
    return;
  }
  await unlink(filePath).catch(() => {});
};

export const downloadFile = async (
  url: string,
  options: DownloadFileOptions = {},
) => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    throw new Error(`Invalid download URL: ${url}`);
  }

  const res = await fetch(parsedUrl);
  if (!res.ok) {
    throw new Error(
      `Error downloading file from: ${url}. Status ${res.status}, Error: ${res.statusText}`,
    );
  }

  const contentLength = Number(res.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(
      `Download exceeds size limit (${contentLength} > ${maxBytes})`,
    );
  }

  const requestedFileName = sanitizeFileName(options.fileName ?? "");
  const fileName = requestedFileName || `file-${randomUUID()}`;
  // Named files get their own subdirectory so concurrent downloads of
  // same-named files cannot clobber each other in the shared temp dir.
  const downloadDir = requestedFileName
    ? join(tempDir, randomUUID())
    : tempDir;

  const contentType = res.headers.get("content-type")?.split(";")[0] || "";
  if (
    options.allowedMimeTypes &&
    options.allowedMimeTypes.length > 0 &&
    !options.allowedMimeTypes.includes(contentType)
  ) {
    throw new Error(`Unsupported content-type: ${contentType || "unknown"}`);
  }

  if (!res.body) {
    throw new Error("Missing response body");
  }

  await mkdir(downloadDir, { recursive: true });

  const extension = mimeToExtension[contentType] || "";
  const docFileName = `${fileName}${extension}`;
  const filePath = join(downloadDir, docFileName);

  // Stream the response straight to disk so memory usage stays constant
  // regardless of file size; enforce the size limit as bytes arrive.
  let total = 0;
  const enforceSizeLimit = async function* (source: AsyncIterable<Uint8Array>) {
    for await (const chunk of source) {
      total += chunk.length;
      if (total > maxBytes) {
        throw new Error(`Download exceeds size limit (${total} > ${maxBytes})`);
      }
      yield chunk;
    }
  };

  try {
    await pipeline(
      enforceSizeLimit(Readable.fromWeb(res.body as never)),
      createWriteStream(filePath),
    );
  } catch (error) {
    await removeDownloadedFile(filePath).catch(() => {});
    throw error;
  }

  return filePath;
};

export const sha256File = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
};

export const sha256Buffer = (data: Buffer | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");
