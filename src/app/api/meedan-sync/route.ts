import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { getGlobalPayload } from "@/lib/payload";
import { downloadFile } from "@/utils/files";
import type { Promise as PayloadPromise } from "@/payload-types";
import {
  buildMeedanIdCandidates,
  normaliseString,
  type MeedanWebhookPayload,
} from "./utils";

const WEBHOOK_SECRET_ENV_KEY = "WEBHOOK_SECRET_KEY";
const ROUTE_TAG = "meedan-sync";
const DEFAULT_MAX_IMAGE_BYTES =
  Number(process.env.MEEDAN_MAX_IMAGE_BYTES) || 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

type WithOptionalId = {
  id?: unknown;
};

type RouteLogLevel = "info" | "warn" | "error";

const toSentryLevel = (
  level: RouteLogLevel,
): "info" | "warning" | "error" => {
  if (level === "warn") {
    return "warning";
  }

  return level;
};

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

const getClientIp = (request: NextRequest): string | null => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return request.headers.get("x-real-ip")?.trim() ?? null;
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

const hasIdProperty = (value: unknown): value is WithOptionalId => {
  return typeof value === "object" && value !== null && "id" in value;
};

const getRelationId = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (hasIdProperty(value)) {
    const maybeId = value.id;
    if (typeof maybeId === "string") {
      const trimmed = maybeId.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof maybeId === "number" && Number.isFinite(maybeId)) {
      return String(maybeId);
    }
  }

  return null;
};

export const POST = async (request: NextRequest) => {
  const startedAt = Date.now();
  const traceId = getTraceId(request);
  const method = request.method;
  const path = request.nextUrl.pathname;
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() ?? null;
  let annotationType: string | null = null;
  let meedanId: string | null = null;

  const buildLogData = (details: Record<string, unknown> = {}) => ({
    route: ROUTE_TAG,
    traceId,
    method,
    path,
    clientIp,
    userAgent,
    durationMs: Date.now() - startedAt,
    annotationType,
    meedanId,
    ...details,
  });

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
    const logPayload = buildLogData({
      event,
      ...details,
      ...(error ? toErrorDetails(error) : {}),
    });

    if (level === "error") {
      console.error("meedan-sync::", logPayload);
      return;
    }

    if (level === "warn") {
      console.warn("meedan-sync::", logPayload);
      return;
    }

    console.info("meedan-sync::", logPayload);
  };

  const captureSentryEvent = ({
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
    Sentry.withScope((scope) => {
      scope.setTag("route", ROUTE_TAG);
      scope.setTag("traceId", traceId);
      scope.setLevel(toSentryLevel(level));
      scope.setContext("request", {
        traceId,
        method,
        path,
        clientIp,
        userAgent,
      });
      scope.setContext("webhook", {
        annotationType,
        meedanId,
      });

      if (Object.keys(details).length > 0) {
        scope.setContext("details", details);
      }

      if (error) {
        scope.setContext("error", toErrorDetails(error));
        Sentry.captureException(error);
        return;
      }

      Sentry.captureMessage(`meedan-sync:: ${event}`, toSentryLevel(level));
    });
  };

  const respond = ({
    status,
    body,
    event,
    details = {},
    level,
    error,
    sentry = false,
  }: {
    status: number;
    body: Record<string, unknown>;
    event: string;
    details?: Record<string, unknown>;
    level?: RouteLogLevel;
    error?: unknown;
    sentry?: boolean;
  }) => {
    const resolvedLevel =
      level ?? (status >= 500 ? "error" : status >= 400 ? "warn" : "info");
    const responseDetails: Record<string, unknown> = {
      status,
      ...details,
    };

    logEvent({
      level: resolvedLevel,
      event,
      details: responseDetails,
      error,
    });

    if (sentry || resolvedLevel === "error") {
      captureSentryEvent({
        level: resolvedLevel,
        event,
        details: responseDetails,
        error,
      });
    }

    return NextResponse.json(body, {
      status,
      headers: {
        "x-trace-id": traceId,
      },
    });
  };

  logEvent({
    level: "info",
    event: "request.received",
  });

  const configuredSecret = process.env[WEBHOOK_SECRET_ENV_KEY];

  if (!configuredSecret) {
    return respond({
      status: 500,
      body: { ok: false, updated: false, error: "Service misconfigured" },
      event: "config.missingWebhookSecret",
      level: "error",
      sentry: true,
    });
  }

  const providedSecret = request.headers.get("authorization")?.trim() ?? null;

  if (!providedSecret || providedSecret !== configuredSecret) {
    return respond({
      status: 401,
      body: { error: "Unauthorized" },
      event: "auth.unauthorized",
      level: "warn",
      details: {
        hasAuthorizationHeader: Boolean(providedSecret),
      },
    });
  }

  let parsed: MeedanWebhookPayload;

  try {
    parsed = await request.json();
  } catch (error) {
    return respond({
      status: 400,
      body: { error: "Invalid JSON" },
      event: "payload.invalidJson",
      level: "warn",
      error,
      sentry: true,
    });
  }

  annotationType = parsed?.object?.annotation_type?.trim() ?? null;
  if (annotationType && annotationType !== "report_design") {
    return respond({
      status: 200,
      body: { ok: true, skipped: true },
      event: "payload.skippedUnsupportedAnnotationType",
      details: {
        annotationType,
      },
    });
  }

  meedanId = normaliseString(parsed?.data?.id);

  if (!meedanId) {
    return respond({
      status: 400,
      body: {
        error: "Missing Meedan ID",
      },
      event: "payload.missingMeedanId",
      level: "warn",
      sentry: true,
    });
  }

  const meedanIdCandidates = buildMeedanIdCandidates(parsed, meedanId);

  const annotationData = parsed?.object?.data;
  const options = annotationData?.options;
  const publishState = normaliseString(annotationData?.state);
  const title = normaliseString(options?.title);
  const description =
    normaliseString(options?.description) ??
    normaliseString(options?.text ?? null);
  const url = normaliseString(options?.published_article_url);
  const headline = normaliseString(options?.headline);
  const fieldValue = normaliseString(
    annotationData?.fields?.[0]?.value ?? null,
  );
  const imageUrl = normaliseString(parsed?.object?.file?.[0]?.url ?? null);

  logEvent({
    level: "info",
    event: "payload.parsed",
    details: {
      meedanIdCandidates,
      hasImageUrl: Boolean(imageUrl),
      hasPublishState: Boolean(publishState),
    },
  });

  try {
    const payload = await getGlobalPayload();
    logEvent({
      level: "info",
      event: "payload.client.ready",
    });

    const { docs } = await payload.find({
      collection: "promises",
      limit: 1,
      where: {
        meedanId: {
          in: meedanIdCandidates,
        },
      },
    });
    logEvent({
      level: "info",
      event: "promise.lookup.completed",
      details: {
        matches: docs.length,
      },
    });

    let promise: PayloadPromise | null = docs[0] ?? null;
    const created = false;
    let updated = false;

    if (!promise) {
      return respond({
        status: 404,
        body: { error: "Promise not found" },
        event: "promise.notFound",
        level: "warn",
        details: {
          meedanIdCandidates,
        },
      });
    }

    const updateData: Partial<PayloadPromise> = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (url) updateData.url = url;
    if (publishState) updateData.publishStatus = publishState;
    if ((promise.meedanId ?? "").trim() !== meedanId) {
      updateData.meedanId = meedanId;
    }

    if (Object.keys(updateData).length > 0) {
      promise = await payload.update({
        collection: "promises",
        id: promise.id,
        data: updateData,
      });
      updated = true;
      logEvent({
        level: "info",
        event: "promise.updated",
        details: {
          promiseId: promise.id,
          updatedFields: Object.keys(updateData),
        },
      });
    }

    if (!promise) {
      return respond({
        status: 500,
        body: { error: "Failed to persist promise" },
        event: "promise.persistFailed",
        level: "error",
        sentry: true,
      });
    }

    if (!imageUrl) {
      return respond({
        status: 200,
        body: { ok: true, created, updated },
        event: "webhook.processedWithoutImage",
        details: {
          promiseId: promise.id,
          created,
          updated,
        },
      });
    }

    if (!imageUrl.startsWith("https://")) {
      return respond({
        status: 400,
        body: { error: "Invalid image URL" },
        event: "image.invalidUrl",
        level: "warn",
        details: {
          imageUrl,
        },
      });
    }

    const fallbackAlt =
      headline ??
      title ??
      description ??
      fieldValue ??
      promise.title?.trim() ??
      promise.description?.trim() ??
      "Meedan promise image";

    let filePath: string | null = null;

    try {
      filePath = await downloadFile(imageUrl, {
        allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
        maxBytes: DEFAULT_MAX_IMAGE_BYTES,
      });
      logEvent({
        level: "info",
        event: "image.downloaded",
        details: {
          promiseId: promise.id,
          imageUrl,
        },
      });

      const existingImageId = getRelationId(promise.image);
      let mediaId = existingImageId;

      if (existingImageId) {
        await payload.update({
          collection: "media",
          id: existingImageId,
          data: {
            alt: fallbackAlt,
          },
          filePath,
        });
        logEvent({
          level: "info",
          event: "image.media.updated",
          details: {
            promiseId: promise.id,
            mediaId: existingImageId,
          },
        });
      } else {
        const media = await payload.create({
          collection: "media",
          data: {
            alt: fallbackAlt,
          },
          filePath,
        });

        mediaId = getRelationId(media);
        logEvent({
          level: "info",
          event: "image.media.created",
          details: {
            promiseId: promise.id,
            mediaId,
          },
        });
      }

      if (!mediaId) {
        return respond({
          status: 500,
          body: { error: "Failed to cache image" },
          event: "image.media.missingId",
          level: "error",
          details: {
            promiseId: promise.id,
            existingImageId,
            imageUrl,
          },
          sentry: true,
        });
      }

      await payload.update({
        collection: "promises",
        id: promise.id,
        data: {
          image: mediaId,
        },
      });

      updated = true;
      return respond({
        status: 200,
        body: { ok: true, created, updated },
        event: "webhook.processedWithImage",
        details: {
          promiseId: promise.id,
          mediaId,
          created,
          updated,
        },
      });
    } finally {
      if (filePath) {
        try {
          await unlink(filePath);
          logEvent({
            level: "info",
            event: "image.tempFile.deleted",
            details: {
              filePath,
            },
          });
        } catch (cleanupError) {
          logEvent({
            level: "warn",
            event: "image.tempFile.cleanupFailed",
            details: {
              filePath,
            },
            error: cleanupError,
          });
          captureSentryEvent({
            level: "warn",
            event: "image.tempFile.cleanupFailed",
            details: {
              filePath,
            },
            error: cleanupError,
          });
        }
      }
    }
  } catch (error) {
    return respond({
      status: 500,
      body: { ok: false, updated: false, error: "Failed to process webhook" },
      event: "webhook.processFailed",
      level: "error",
      details: {
        imageUrl,
      },
      error,
      sentry: true,
    });
  }
};
