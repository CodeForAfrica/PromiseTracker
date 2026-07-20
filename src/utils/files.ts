import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, unlink } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

import { validateFileSignature } from "@/utils/fileSignature";
import {
  assertResolvesToPublicAddresses,
  assertSafeRemoteUrl,
  type LookupFn,
} from "@/utils/ssrf";

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
const DEFAULT_MAX_REDIRECTS =
  Number(process.env.DOWNLOAD_MAX_REDIRECTS) || 3;
// Time allowed to connect and receive response headers, per redirect hop.
const DEFAULT_RESPONSE_TIMEOUT_MS =
  Number(process.env.DOWNLOAD_RESPONSE_TIMEOUT_MS) || 30_000;
// Overall deadline for the whole download, body streaming included.
const DEFAULT_TOTAL_TIMEOUT_MS =
  Number(process.env.DOWNLOAD_TOTAL_TIMEOUT_MS) || 5 * 60_000;
const MAX_CONCURRENT_DOWNLOADS =
  Number(process.env.MAX_CONCURRENT_DOWNLOADS) || 4;

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

// Process-wide semaphore so a burst of webhook/task activity cannot open an
// unbounded number of simultaneous remote downloads.
let activeDownloads = 0;
const downloadWaiters: Array<() => void> = [];

const acquireDownloadSlot = async (): Promise<void> => {
  if (activeDownloads < MAX_CONCURRENT_DOWNLOADS) {
    activeDownloads += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    downloadWaiters.push(resolve);
  });
  activeDownloads += 1;
};

const releaseDownloadSlot = (): void => {
  activeDownloads -= 1;
  const next = downloadWaiters.shift();
  if (next) {
    next();
  }
};

type DownloadFileOptions = {
  allowedMimeTypes?: string[];
  maxBytes?: number;
  fileName?: string;
  /**
   * Hostname allowlist applied to the initial URL (exact hostnames or
   * "*.suffix" wildcards). Redirect hops always get HTTPS + address checks.
   */
  allowedHostnames?: string[];
  requireHttps?: boolean;
  /**
   * Skips SSRF address checks. ONLY for URLs the application built itself
   * against its own configured origin (e.g. fetching its own media in
   * development) — never for URLs containing external input.
   */
  allowPrivateAddresses?: boolean;
  maxRedirects?: number;
  responseTimeoutMs?: number;
  totalTimeoutMs?: number;
  /** Verify magic bytes of the downloaded file against its content type. */
  verifySignature?: boolean;
  /** DNS lookup override, for tests. */
  lookup?: LookupFn;
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

/**
 * Follows redirects manually so every destination is re-validated against
 * the SSRF rules before it is dialled, with a bounded hop count and a
 * per-hop response-header timeout.
 */
const fetchWithValidatedRedirects = async (
  initialUrl: URL,
  {
    allowedHostnames,
    requireHttps,
    allowPrivateAddresses,
    maxRedirects,
    responseTimeoutMs,
    lookup,
  }: {
    allowedHostnames?: string[];
    requireHttps: boolean;
    allowPrivateAddresses: boolean;
    maxRedirects: number;
    responseTimeoutMs: number;
    lookup?: LookupFn;
  },
): Promise<Response> => {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    assertSafeRemoteUrl(currentUrl, {
      // The allowlist constrains where a download may start; redirect hops
      // still must be public HTTPS hosts.
      allowedHostnames: hop === 0 ? allowedHostnames : undefined,
      requireHttps,
      allowPrivateAddresses,
    });
    if (!allowPrivateAddresses) {
      await assertResolvesToPublicAddresses(currentUrl, lookup);
    }

    const res = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(responseTimeoutMs),
    });

    if (!REDIRECT_STATUS_CODES.has(res.status)) {
      return res;
    }

    // Discard the redirect body so the connection can be reused/closed.
    await res.body?.cancel().catch(() => {});

    const location = res.headers.get("location");
    if (!location) {
      throw new Error(
        `Redirect response from ${currentUrl.host} is missing a Location header`,
      );
    }

    if (hop === maxRedirects) {
      throw new Error(
        `Download exceeded the maximum of ${maxRedirects} redirects`,
      );
    }

    currentUrl = new URL(location, currentUrl);
  }

  // Unreachable: the loop always returns or throws.
  throw new Error("Redirect handling exhausted unexpectedly");
};

export const downloadFile = async (
  url: string,
  options: DownloadFileOptions = {},
) => {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const responseTimeoutMs =
    options.responseTimeoutMs ?? DEFAULT_RESPONSE_TIMEOUT_MS;
  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  const requireHttps = options.requireHttps ?? true;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch (_error) {
    throw new Error(`Invalid download URL: ${url}`);
  }

  await acquireDownloadSlot();

  try {
    const startedAt = Date.now();
    const res = await fetchWithValidatedRedirects(parsedUrl, {
      allowedHostnames: options.allowedHostnames,
      requireHttps,
      allowPrivateAddresses: options.allowPrivateAddresses ?? false,
      maxRedirects,
      responseTimeoutMs,
      lookup: options.lookup,
    });

    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(
        `Error downloading file from: ${url}. Status ${res.status}, Error: ${res.statusText}`,
      );
    }

    const contentLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await res.body?.cancel().catch(() => {});
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
      await res.body?.cancel().catch(() => {});
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
    // regardless of file size; enforce the size limit and overall deadline
    // as bytes arrive.
    let total = 0;
    const enforceStreamLimits = async function* (
      source: AsyncIterable<Uint8Array>,
    ) {
      for await (const chunk of source) {
        total += chunk.length;
        if (total > maxBytes) {
          throw new Error(
            `Download exceeds size limit (${total} > ${maxBytes})`,
          );
        }
        if (Date.now() - startedAt > totalTimeoutMs) {
          throw new Error(
            `Download exceeded the total time limit of ${totalTimeoutMs}ms`,
          );
        }
        yield chunk;
      }
    };

    try {
      await pipeline(
        enforceStreamLimits(Readable.fromWeb(res.body as never)),
        createWriteStream(filePath),
      );

      if (options.verifySignature) {
        const signatureCheck = await validateFileSignature(filePath, {
          mimeType: contentType || null,
        });
        if (!signatureCheck.ok) {
          throw new Error(
            `Downloaded file failed content validation: ${signatureCheck.message}`,
          );
        }
      }
    } catch (error) {
      await removeDownloadedFile(filePath).catch(() => {});
      throw error;
    }

    return filePath;
  } finally {
    releaseDownloadSlot();
  }
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
