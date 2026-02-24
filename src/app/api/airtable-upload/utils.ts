import { timingSafeEqual } from "node:crypto";

export type UploadKind = "document" | "entityImage";

const DEFAULT_MAX_IMAGE_BYTES =
  Number(process.env.AIRTABLE_UPLOAD_MAX_IMAGE_BYTES) || 12 * 1024 * 1024;
const DEFAULT_MAX_DOCUMENT_BYTES =
  Number(process.env.AIRTABLE_UPLOAD_MAX_DOCUMENT_BYTES) || 1024 * 1024 * 1024;

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".svg",
]);

const formatBytesToMb = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

type UploadPolicy = {
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  allowedExtensions: Set<string>;
};

type UploadValidation =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; message: string };

export type UploadMetadataValidationInput = {
  fileName: string;
  mimeType?: string | null;
};

const parseOrigins = (): string[] => {
  return (process.env.AIRTABLE_UPLOAD_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const normalizeOriginString = (value: string): string =>
  value.trim().replace(/\/+$/, "");

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wildcardToRegex = (pattern: string): RegExp => {
  const escaped = escapeRegex(pattern).replace(/\\\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
};

const isOriginMatchedByRule = (requestOrigin: string, rawRule: string): boolean => {
  const normalizedOrigin = normalizeOriginString(requestOrigin);
  const normalizedRule = normalizeOriginString(rawRule);

  if (!normalizedRule) {
    return false;
  }

  if (normalizedRule === "*") {
    return true;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(normalizedOrigin);
  } catch {
    return false;
  }

  const originHost = parsedOrigin.host.toLowerCase();
  const originHostname = parsedOrigin.hostname.toLowerCase();
  const lowerRule = normalizedRule.toLowerCase();

  if (lowerRule.includes("://")) {
    if (!lowerRule.includes("*")) {
      return normalizedOrigin.toLowerCase() === lowerRule;
    }

    return wildcardToRegex(lowerRule).test(normalizedOrigin.toLowerCase());
  }

  if (lowerRule.startsWith("*.")) {
    const suffix = lowerRule.slice(2);
    return originHostname === suffix || originHostname.endsWith(`.${suffix}`);
  }

  if (lowerRule.startsWith(".")) {
    const suffix = lowerRule.slice(1);
    return originHostname === suffix || originHostname.endsWith(`.${suffix}`);
  }

  if (lowerRule.includes("*")) {
    const hostRegex = wildcardToRegex(lowerRule);
    return hostRegex.test(originHost) || hostRegex.test(originHostname);
  }

  return originHost === lowerRule || originHostname === lowerRule;
};

const isAllowedOrigin = (
  requestOrigin: string | null,
  allowedOrigins: string[],
): boolean => {
  if (!requestOrigin) {
    return false;
  }

  return allowedOrigins.some((rule) => isOriginMatchedByRule(requestOrigin, rule));
};

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const getExtension = (fileName: string): string => {
  const trimmed = fileName.trim();
  if (!trimmed.includes(".")) {
    return "";
  }

  return `.${trimmed.split(".").pop()?.toLowerCase() ?? ""}`;
};

const getUploadPolicy = (kind: UploadKind): UploadPolicy => {
  if (kind === "entityImage") {
    return {
      maxBytes: DEFAULT_MAX_IMAGE_BYTES,
      allowedMimeTypes: IMAGE_MIME_TYPES,
      allowedExtensions: IMAGE_EXTENSIONS,
    };
  }

  return {
    maxBytes: DEFAULT_MAX_DOCUMENT_BYTES,
    allowedMimeTypes: DOCUMENT_MIME_TYPES,
    allowedExtensions: DOCUMENT_EXTENSIONS,
  };
};

export const getUploadMaxBytes = (kind: UploadKind): number =>
  getUploadPolicy(kind).maxBytes;

export const validateUploadMetadata = (
  metadata: UploadMetadataValidationInput,
  kind: UploadKind,
): UploadValidation => {
  const policy = getUploadPolicy(kind);
  const mimeType = (metadata.mimeType ?? "").trim().toLowerCase();
  const extension = getExtension(metadata.fileName);
  const mimeAllowed = mimeType ? policy.allowedMimeTypes.has(mimeType) : false;
  const extensionAllowed =
    extension.length > 0 ? policy.allowedExtensions.has(extension) : false;

  if (!mimeAllowed && !extensionAllowed) {
    return {
      ok: false,
      status: 415,
      message: `Unsupported file type: ${mimeType || extension || "unknown"}.`,
    };
  }

  return { ok: true };
};

export const inferUploadKindFromMetadata = (
  metadata: UploadMetadataValidationInput,
): UploadKind | null => {
  const isDocument = validateUploadMetadata(metadata, "document").ok;
  const isEntityImage = validateUploadMetadata(metadata, "entityImage").ok;

  if (isDocument === isEntityImage) {
    return null;
  }

  return isDocument ? "document" : "entityImage";
};

export const validateUploadSize = (
  fileSize: number,
  kind: UploadKind,
): UploadValidation => {
  if (!fileSize || fileSize <= 0) {
    return {
      ok: false,
      status: 400,
      message: "Uploaded file is empty.",
    };
  }

  const maxBytes = getUploadPolicy(kind).maxBytes;
  if (fileSize > maxBytes) {
    return {
      ok: false,
      status: 413,
      message:
        `File size ${formatBytesToMb(fileSize)} exceeds the limit of ${formatBytesToMb(maxBytes)} for ${kind === "entityImage" ? "image" : "document"} uploads.`,
    };
  }

  return { ok: true };
};

export const getCorsHeaders = (requestOrigin: string | null): HeadersInit => {
  const allowedOrigins = parseOrigins();

  let allowedOriginHeader = "*";
  if (allowedOrigins.length > 0) {
    allowedOriginHeader =
      requestOrigin && isAllowedOrigin(requestOrigin, allowedOrigins)
        ? requestOrigin
        : "null";
  }

  return {
    "Access-Control-Allow-Origin": allowedOriginHeader,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
};

export const isAuthorizedUploadRequest = (
  authorizationHeader: string | null,
): boolean => {
  const expectedToken = (process.env.AIRTABLE_UPLOAD_TOKEN ?? "").trim();
  if (!expectedToken) {
    return false;
  }

  if (!authorizationHeader) {
    return false;
  }

  const [scheme, token = ""] = authorizationHeader.split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  return safeCompare(token, expectedToken);
};

export const parseUploadKind = (value: unknown): UploadKind | null => {
  if (typeof value !== "string") {
    return null;
  }

  if (value === "document" || value === "entityImage") {
    return value;
  }

  return null;
};

export const resolveAbsoluteMediaUrl = (
  relativeOrAbsoluteUrl: string,
  requestOrigin: string,
): string => {
  const configuredOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const baseOrigin = configuredOrigin || requestOrigin;

  try {
    return new URL(relativeOrAbsoluteUrl, baseOrigin).toString();
  } catch {
    return relativeOrAbsoluteUrl;
  }
};

export const sanitizeUploadFileName = (fileName: string): string => {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "upload";
  }

  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_");
};
