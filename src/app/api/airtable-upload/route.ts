import Busboy from "busboy";
import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";
import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { getGlobalPayload } from "@/lib/payload";
import {
  getCorsHeaders,
  getUploadMaxBytes,
  inferUploadKindFromMetadata,
  isAuthorizedUploadRequest,
  parseUploadKind,
  resolveAbsoluteMediaUrl,
  sanitizeUploadFileName,
  validateUploadMetadata,
  validateUploadSize,
  type UploadKind,
} from "./utils";

export const runtime = "nodejs";
const ROUTE_TAG = "airtable-upload";

type UploadSuccessResponse = {
  ok: true;
  url: string;
  filename: string;
  mimeType: string;
  filesize: number;
  mediaId: string;
};

type ParsedMultipartUpload = {
  kind: UploadKind;
  alt: string | null;
  originalFilename: string;
  mimeType: string;
  filesize: number;
  tempFilePath: string;
};

class UploadRouteError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type RouteLogLevel = "info" | "warn" | "error";

const getTraceId = (request: NextRequest): string => {
  const headerTraceId =
    request.headers.get("x-request-id")?.trim() ||
    request.headers.get("cf-ray")?.trim() ||
    request.headers.get("x-cloud-trace-context")?.split("/")[0]?.trim() ||
    request.headers.get("sentry-trace")?.split("-")[0]?.trim() ||
    null;

  if (headerTraceId) {
    return headerTraceId;
  }

  return randomUUID();
};

const toErrorDetails = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return {
    errorMessage: String(error),
  };
};

const jsonResponse = <T extends Record<string, unknown>>(
  request: NextRequest,
  status: number,
  body: T,
  traceId?: string,
) => {
  const baseHeaders = getCorsHeaders(request.headers.get("origin")) as Record<
    string,
    string
  >;

  return NextResponse.json(body, {
    status,
    headers: traceId
      ? {
          ...baseHeaders,
          "x-trace-id": traceId,
        }
      : baseHeaders,
  });
};

const toUploadRouteError = (error: unknown): UploadRouteError => {
  if (error instanceof UploadRouteError) {
    return error;
  }

  if (error instanceof Error) {
    return new UploadRouteError(500, error.message);
  }

  return new UploadRouteError(500, "Upload failed.");
};

const parseMultipartUpload = async (
  request: NextRequest,
  onTempFilePathCreated: (tempPath: string) => void,
): Promise<ParsedMultipartUpload> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new UploadRouteError(
      400,
      'Content-Type must be "multipart/form-data".',
    );
  }

  if (!request.body) {
    throw new UploadRouteError(400, "Missing upload body.");
  }

  const maxMultipartBytes = Math.max(
    getUploadMaxBytes("document"),
    getUploadMaxBytes("entityImage"),
  );

  return await new Promise<ParsedMultipartUpload>((resolve, reject) => {
    const headers = Object.fromEntries(request.headers.entries()) as Record<
      string,
      string
    >;
    const busboy = Busboy({
      headers,
      limits: {
        files: 1,
        fields: 4,
        parts: 6,
        fileSize: maxMultipartBytes,
      },
    });

    const nodeStream = Readable.fromWeb(
      request.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
    );

    let settled = false;
    let kind: UploadKind | null = null;
    let kindFieldSeen = false;
    let alt: string | null = null;
    let altFieldSeen = false;
    let fileSeen = false;
    let originalFilename = "upload";
    let mimeType = "";
    let fileSize = 0;
    let tempFilePath: string | null = null;
    let fileWritePromise: Promise<void> | null = null;
    let activeWriteStream: ReturnType<typeof createWriteStream> | null = null;
    let inferredKind: UploadKind | null = null;

    const settleReject = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;

      if (activeWriteStream && !activeWriteStream.destroyed) {
        activeWriteStream.destroy();
      }

      nodeStream.destroy();
      reject(toUploadRouteError(error));
    };

    const settleResolve = (value: ParsedMultipartUpload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    busboy.on("field", (fieldName, value) => {
      if (settled) {
        return;
      }

      if (fieldName === "kind") {
        if (kindFieldSeen) {
          settleReject(
            new UploadRouteError(400, 'Duplicate "kind" field is not allowed.'),
          );
          return;
        }
        kindFieldSeen = true;

        const parsedKind = parseUploadKind(value);
        if (!parsedKind) {
          settleReject(
            new UploadRouteError(
              400,
              'Missing or invalid "kind". Use "document" or "entityImage".',
            ),
          );
          return;
        }

        kind = parsedKind;

        if (fileSeen) {
          const metadataValidation = validateUploadMetadata(
            {
              fileName: originalFilename,
              mimeType,
            },
            kind,
          );
          if (!metadataValidation.ok) {
            settleReject(
              new UploadRouteError(
                metadataValidation.status,
                metadataValidation.message,
              ),
            );
            return;
          }

          const sizeValidation = validateUploadSize(fileSize, kind);
          if (!sizeValidation.ok) {
            settleReject(
              new UploadRouteError(sizeValidation.status, sizeValidation.message),
            );
            return;
          }
        }

        return;
      }

      if (fieldName === "alt") {
        if (altFieldSeen) {
          settleReject(
            new UploadRouteError(400, 'Duplicate "alt" field is not allowed.'),
          );
          return;
        }
        altFieldSeen = true;

        const trimmed = value.trim();
        alt = trimmed.length > 0 ? trimmed : null;
      }
    });

    busboy.on("file", (fieldName, fileStream, info) => {
      if (settled) {
        fileStream.resume();
        return;
      }

      if (fieldName !== "file") {
        fileStream.resume();
        return;
      }

      if (fileSeen) {
        fileStream.resume();
        settleReject(new UploadRouteError(400, "Only one file upload is allowed."));
        return;
      }

      fileSeen = true;
      originalFilename = info.filename?.trim() || "upload";
      mimeType = (info.mimeType ?? "").trim().toLowerCase();
      inferredKind = inferUploadKindFromMetadata({
        fileName: originalFilename,
        mimeType,
      });

      if (kind) {
        const metadataValidation = validateUploadMetadata(
          {
            fileName: originalFilename,
            mimeType,
          },
          kind,
        );
        if (!metadataValidation.ok) {
          fileStream.resume();
          settleReject(
            new UploadRouteError(
              metadataValidation.status,
              metadataValidation.message,
            ),
          );
          return;
        }
      }

      const safeName = sanitizeUploadFileName(originalFilename);
      tempFilePath = join(tmpdir(), `${randomUUID()}-${safeName}`);
      onTempFilePathCreated(tempFilePath);

      const writeStream = createWriteStream(tempFilePath, { flags: "w" });
      activeWriteStream = writeStream;
      let fileStreamStopped = false;
      const stopFileStream = () => {
        if (fileStreamStopped) {
          return;
        }

        fileStreamStopped = true;
        fileStream.unpipe(writeStream);
        fileStream.pause();
        fileStream.destroy();
      };

      fileStream.on("limit", () => {
        stopFileStream();
        writeStream.destroy();
        settleReject(
          new UploadRouteError(
            413,
            `File size exceeds the maximum allowed upload size of ${(
              maxMultipartBytes /
              (1024 * 1024)
            ).toFixed(2)} MB.`,
          ),
        );
      });

      fileStream.on("data", (chunk: Buffer) => {
        fileSize += chunk.length;

        // Accept either part ordering and still enforce streaming size checks.
        const sizeValidationKind = kind ?? inferredKind;
        if (!sizeValidationKind) {
          return;
        }

        const sizeValidation = validateUploadSize(fileSize, sizeValidationKind);
        if (!sizeValidation.ok) {
          stopFileStream();
          writeStream.destroy();
          settleReject(
            new UploadRouteError(sizeValidation.status, sizeValidation.message),
          );
        }
      });

      fileStream.on("error", (error) => {
        stopFileStream();
        writeStream.destroy();
        settleReject(error);
      });

      writeStream.on("error", (error) => {
        settleReject(error);
      });

      writeStream.on("close", () => {
        if (activeWriteStream === writeStream) {
          activeWriteStream = null;
        }
      });

      fileStream.pipe(writeStream);
      const writeFinishedPromise = finished(writeStream);
      fileWritePromise = writeFinishedPromise.then(() => undefined);
      fileWritePromise.catch(() => undefined);
    });

    busboy.on("filesLimit", () => {
      settleReject(new UploadRouteError(400, "Only one file upload is allowed."));
    });

    busboy.on("partsLimit", () => {
      settleReject(
        new UploadRouteError(400, "Too many multipart fields in upload payload."),
      );
    });

    busboy.on("error", (error) => {
      settleReject(error);
    });

    busboy.on("finish", async () => {
      if (settled) {
        return;
      }

      try {
        if (!kind) {
          throw new UploadRouteError(
            400,
            'Missing or invalid "kind". Use "document" or "entityImage".',
          );
        }

        if (!fileSeen || !fileWritePromise || !tempFilePath) {
          throw new UploadRouteError(400, 'Missing "file" upload payload.');
        }

        await fileWritePromise;

        const metadataValidation = validateUploadMetadata(
          {
            fileName: originalFilename,
            mimeType,
          },
          kind,
        );
        if (!metadataValidation.ok) {
          throw new UploadRouteError(
            metadataValidation.status,
            metadataValidation.message,
          );
        }

        const sizeValidation = validateUploadSize(fileSize, kind);
        if (!sizeValidation.ok) {
          throw new UploadRouteError(sizeValidation.status, sizeValidation.message);
        }

        settleResolve({
          kind,
          alt,
          originalFilename,
          mimeType,
          filesize: fileSize,
          tempFilePath,
        });
      } catch (error) {
        settleReject(error);
      }
    });

    nodeStream.on("error", (error) => {
      settleReject(error);
    });

    nodeStream.pipe(busboy);
  });
};

export const OPTIONS = async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get("origin")),
  });
};

export const POST = async (request: NextRequest) => {
  const startedAt = Date.now();
  const traceId = getTraceId(request);
  const method = request.method;
  const path = request.nextUrl.pathname;
  const requestOrigin = request.headers.get("origin");
  const userAgent = request.headers.get("user-agent")?.trim() ?? null;
  let tempFilePath: string | null = null;
  const parsedUploadLogContext: {
    uploadKind: UploadKind | null;
    uploadMimeType: string | null;
    uploadSizeBytes: number | null;
  } = {
    uploadKind: null,
    uploadMimeType: null,
    uploadSizeBytes: null,
  };

  const logEvent = ({
    level,
    event,
    details = {},
    error,
  }: {
    level: RouteLogLevel;
    event: string;
    details?: Record<string, unknown>;
    error?: unknown;
  }) => {
    const payload = {
      route: ROUTE_TAG,
      traceId,
      method,
      path,
      origin: requestOrigin,
      userAgent,
      durationMs: Date.now() - startedAt,
      ...details,
      ...(error ? toErrorDetails(error) : {}),
    };

    Sentry.logger[level](`airtable-upload.${event}`, payload);
  };

  logEvent({
    level: "info",
    event: "request.received",
  });

  if (!isAuthorizedUploadRequest(request.headers.get("authorization"))) {
    logEvent({
      level: "warn",
      event: "auth.unauthorized",
      details: {
        status: 401,
      },
    });
    return jsonResponse(
      request,
      401,
      {
        ok: false,
        error: "Unauthorized",
      },
      traceId,
    );
  }

  try {
    return await Sentry.startSpan(
      {
        op: "http.server",
        name: "POST /api/airtable-upload",
        attributes: {
          route: ROUTE_TAG,
          method,
          path,
          traceId,
        },
      },
      async () => {
        const parsedUpload = await Sentry.startSpan(
          {
            op: "route.parse_multipart",
            name: "parse multipart upload",
            attributes: {
              route: ROUTE_TAG,
              traceId,
            },
          },
          () =>
            parseMultipartUpload(request, (path) => {
              tempFilePath = path;
            }),
        );
        parsedUploadLogContext.uploadKind = parsedUpload.kind;
        parsedUploadLogContext.uploadMimeType = parsedUpload.mimeType;
        parsedUploadLogContext.uploadSizeBytes = parsedUpload.filesize;

        const payload = await getGlobalPayload();
        const alt =
          parsedUpload.alt && parsedUpload.alt.trim().length > 0
            ? parsedUpload.alt.trim()
            : parsedUpload.originalFilename || `${parsedUpload.kind} upload`;

        const createdMedia = await Sentry.startSpan(
          {
            op: "payload.create",
            name: "create media upload record",
            attributes: {
              route: ROUTE_TAG,
              traceId,
              uploadKind: parsedUpload.kind,
              uploadMimeType: parsedUpload.mimeType,
              uploadSizeBytes: parsedUpload.filesize,
            },
          },
          () =>
            payload.create({
              collection: "media",
              data: {
                alt,
              },
              filePath: parsedUpload.tempFilePath,
              depth: 0,
            }),
        );

        const mediaDoc = await Sentry.startSpan(
          {
            op: "payload.findByID",
            name: "load uploaded media record",
            attributes: {
              route: ROUTE_TAG,
              traceId,
              mediaId: createdMedia.id,
            },
          },
          () =>
            payload.findByID({
              collection: "media",
              id: createdMedia.id,
              depth: 0,
            }),
        );

        if (!mediaDoc?.url) {
          logEvent({
            level: "error",
            event: "upload.mediaUrlMissing",
            details: {
              status: 500,
              mediaId: mediaDoc?.id ?? createdMedia.id,
            },
          });
          Sentry.captureMessage("airtable-upload.media-url-missing", "error");
          return jsonResponse(
            request,
            500,
            {
              ok: false,
              error: "Upload succeeded but media URL is unavailable.",
            },
            traceId,
          );
        }

        const absoluteUrl = resolveAbsoluteMediaUrl(
          mediaDoc.url,
          request.nextUrl.origin,
        );

        if ((mediaDoc.externalUrl ?? "").trim() !== absoluteUrl) {
          await Sentry.startSpan(
            {
              op: "payload.update",
              name: "update media externalUrl",
              attributes: {
                route: ROUTE_TAG,
                traceId,
                mediaId: mediaDoc.id,
              },
            },
            () =>
              payload.update({
                collection: "media",
                id: mediaDoc.id,
                data: {
                  externalUrl: absoluteUrl,
                },
                depth: 0,
              }),
          );
        }

        const responseBody: UploadSuccessResponse = {
          ok: true,
          url: absoluteUrl,
          filename: mediaDoc.filename ?? parsedUpload.originalFilename,
          mimeType:
            mediaDoc.mimeType ?? parsedUpload.mimeType ?? "application/octet-stream",
          filesize: mediaDoc.filesize ?? parsedUpload.filesize,
          mediaId: mediaDoc.id,
        };

        logEvent({
          level: "info",
          event: "upload.completed",
          details: {
            status: 200,
            mediaId: responseBody.mediaId,
            uploadKind: parsedUpload.kind,
            uploadMimeType: responseBody.mimeType,
            uploadSizeBytes: responseBody.filesize,
          },
        });

        return jsonResponse(request, 200, responseBody, traceId);
      },
    );
  } catch (error) {
    const routeError = toUploadRouteError(error);

    logEvent({
      level: routeError.status >= 500 ? "error" : "warn",
      event: "upload.failed",
      details: {
        status: routeError.status,
        uploadKind: parsedUploadLogContext.uploadKind,
        uploadMimeType: parsedUploadLogContext.uploadMimeType,
        uploadSizeBytes: parsedUploadLogContext.uploadSizeBytes,
      },
      error,
    });

    if (routeError.status >= 500) {
      Sentry.withScope((scope) => {
        scope.setTag("route", ROUTE_TAG);
        scope.setTag("traceId", traceId);
        scope.setContext("airtableUpload", {
          status: routeError.status,
          method,
          path,
          origin: requestOrigin,
          uploadKind: parsedUploadLogContext.uploadKind,
          uploadMimeType: parsedUploadLogContext.uploadMimeType,
          uploadSizeBytes: parsedUploadLogContext.uploadSizeBytes,
        });
        Sentry.captureException(error);
      });
    }

    return jsonResponse(
      request,
      routeError.status,
      {
        ok: false,
        error: routeError.message,
      },
      traceId,
    );
  } finally {
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (_cleanupError) {
        logEvent({
          level: "warn",
          event: "cleanup.tempFileDeleteFailed",
          details: {
            tempFilePath,
          },
          error: _cleanupError,
        });
        // Ignore cleanup failures for temporary upload files.
      }
    }
  }
};
