import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";

import * as Sentry from "@sentry/nextjs";

import { getGlobalPayload } from "@/lib/payload";
import { downloadFile } from "@/utils/files";
import type { Promise as PayloadPromise } from "@/payload-types";

const WEBHOOK_SECRET_ENV_KEY = "WEBHOOK_SECRET_KEY";

type MeedanFile = {
  url?: unknown;
};

type MeedanField = {
  value?: unknown;
};

type ReportDesignOptions = {
  title?: unknown;
  description?: unknown;
  text?: unknown;
  headline?: unknown;
  published_article_url?: unknown;
  deadline?: unknown;
};

type ReportDesignData = {
  options?: ReportDesignOptions | null;
  state?: unknown;
  fields?: MeedanField[];
};

type MeedanWebhookPayload = {
  data?: {
    id?: unknown;
  };
  object?: {
    annotation_type?: string | null;
    file?: MeedanFile[];
    data?: ReportDesignData | null;
  };
};

const normaliseString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

type WithOptionalId = {
  id?: unknown;
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
  const configuredSecret = process.env[WEBHOOK_SECRET_ENV_KEY];

  if (!configuredSecret) {
    const message =
      "meedan-sync:: Missing WEBHOOK_SECRET_KEY environment variable";

    console.error(message);
    Sentry.captureMessage(message, "error");
    return NextResponse.json(
      { ok: false, updated: false, error: "Service misconfigured" },
      { status: 200 }
    );
  }

  const providedSecret = request.headers.get("authorization")?.trim() ?? null;

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: MeedanWebhookPayload;

  try {
    parsed = await request.json();
  } catch (_error) {
    const message = "meedan-sync:: Failed to parse JSON payload";

    console.error(message);
    Sentry.captureMessage(message, "error");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  Sentry.captureMessage(
    `meedan-sync:: Received webhook payload ${JSON.stringify(parsed)}`,
    "info"
  );
  const annotationType = parsed?.object?.annotation_type?.trim();
  if (annotationType && annotationType !== "report_design") {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }
  const meedanId = normaliseString(parsed?.data?.id);

  if (!meedanId) {
    const message = "meedan-sync:: Missing Meedan ID";

    console.error(message);
    Sentry.captureMessage(message, "error");
    return NextResponse.json(
      {
        error: "Missing Meedan ID",
      },
      { status: 400 }
    );
  }

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
    annotationData?.fields?.[0]?.value ?? null
  );
  const imageUrl = normaliseString(parsed?.object?.file?.[0]?.url ?? null);

  try {
    const payload = await getGlobalPayload();

    const { docs } = await payload.find({
      collection: "promises",
      limit: 1,
      where: {
        meedanId: {
          equals: meedanId,
        },
      },
    });

    let promise: PayloadPromise | null = docs[0] ?? null;
    let created = false;
    let updated = false;

    const hasTextPayload = Boolean(title || description || url);

    if (!promise) {
      if (!hasTextPayload) {
        const message =
          "meedan-sync:: Promise not found and payload missing content";

        console.error(message);
        Sentry.captureMessage(message, "error");
        return NextResponse.json(
          { error: "Promise not found" },
          { status: 404 }
        );
      }

      promise = await payload.create({
        collection: "promises",
        data: {
          title,
          description,
          url,
          publishStatus: publishState,
          meedanId,
        },
      });

      created = true;
    } else {
      const updateData: Partial<PayloadPromise> = {};
      if (title) updateData.title = title;
      if (description) updateData.description = description;
      if (url) updateData.url = url;
      if (publishState) updateData.publishStatus = publishState;

      if (Object.keys(updateData).length > 0) {
        promise = await payload.update({
          collection: "promises",
          id: promise.id,
          data: updateData,
        });
        updated = true;
      }
    }

    if (!promise) {
      const message = "meedan-sync:: Failed to persist promise record";

      console.error(message);
      Sentry.captureMessage(message, "error");
      return NextResponse.json(
        { error: "Failed to persist promise" },
        { status: 500 }
      );
    }

    if (!imageUrl) {
      return NextResponse.json({ ok: true, created, updated }, { status: 200 });
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
      filePath = await downloadFile(imageUrl);

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
      } else {
        const media = await payload.create({
          collection: "media",
          data: {
            alt: fallbackAlt,
          },
          filePath,
        });

        mediaId = getRelationId(media);
      }

      if (!mediaId) {
        Sentry.withScope((scope) => {
          scope.setTag("route", "meedan-sync");
          scope.setContext("promise", {
            id: promise?.id,
            existingImageId,
            meedanId,
            imageUrl,
          });
          Sentry.captureMessage(
            "meedan-sync:: Failed to cache image after processing webhook",
            "error"
          );
        });
        return NextResponse.json(
          { error: "Failed to cache image" },
          { status: 500 }
        );
      }

      await payload.update({
        collection: "promises",
        id: promise.id,
        data: {
          image: mediaId,
        },
      });

      return NextResponse.json(
        { ok: true, created, updated: true },
        { status: 200 }
      );
    } finally {
      if (filePath) {
        try {
          await unlink(filePath);
        } catch (cleanupError) {
          console.warn(
            "meedan-sync:: Failed to clean up temp image",
            cleanupError
          );

          Sentry.withScope((scope) => {
            scope.setTag("route", "meedan-sync");
            scope.setLevel("warning");
            scope.setContext("cleanup", {
              filePath,
            });
            Sentry.captureException(cleanupError);
          });
        }
      }
    }
  } catch (error) {
    console.error("meedan-sync:: Failed to process webhook", error);

    Sentry.withScope((scope) => {
      scope.setTag("route", "meedan-sync");
      scope.setContext("payload", {
        meedanId,
        imageUrl,
      });
      Sentry.captureException(error);
    });
    return NextResponse.json(
      { ok: false, updated: false, error: "Failed to process webhook" },
      { status: 200 }
    );
  }
};
