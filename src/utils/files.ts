import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  Number(process.env.MAX_DOWNLOAD_BYTES) || 100 * 1024 * 1024;

type DownloadFileOptions = {
  allowedMimeTypes?: string[];
  maxBytes?: number;
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

  if (!existsSync(tempDir)) {
    await mkdir(tempDir, { recursive: true });
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

  const fileName = `file-${randomUUID()}`;

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

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > maxBytes) {
      throw new Error(`Download exceeds size limit (${total} > ${maxBytes})`);
    }
    chunks.push(value);
  }

  const buffer = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    total,
  );
  const extension = mimeToExtension[contentType] || "";
  const docFileName = `${fileName}${extension}`;
  const filePath = join(tempDir, docFileName);
  await writeFile(filePath, Buffer.from(buffer), { flag: "w" });
  return filePath;
};
