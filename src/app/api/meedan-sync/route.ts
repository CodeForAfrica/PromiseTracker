import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";

import * as Sentry from "@sentry/nextjs";

import { getGlobalPayload } from "@/lib/payload";
import type { Media, Promise as PromiseDoc } from "@/payload-types";
import { downloadFile } from "@/utils/files";

const WEBHOOK_SECRET_ENV_KEY = "WEBHOOK_SECRET_KEY";

type MeedanFile = {
  url?: unknown;
};

type MeedanField = {
  value?: unknown;
};

type MeedanWebhookPayload = {
  data?: {
    id?: unknown;
  };
  object?: {
    file?: MeedanFile[];
    data?: {
      fields?: MeedanField[];
    };
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

  if (typeof value === "object") {
    const maybeId = (value as { id?: unknown }).id;
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
    parsed = (await request.json()) as MeedanWebhookPayload;
  } catch (_error) {
    const message = "meedan-sync:: Failed to parse JSON payload";

    console.error(message);
    Sentry.captureMessage(message, "error");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
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

  const imageUrl = normaliseString(parsed?.object?.file?.[0]?.url ?? null);

  if (!imageUrl) {
    const message = "meedan-sync:: Missing image URL";

    console.error(message);
    Sentry.captureMessage(message, "error");
    return NextResponse.json(
      { error: "No image URL provided" },
      { status: 400 }
    );
  }

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

    const promise = (docs[0] ?? null) as PromiseDoc | null;

    if (!promise) {
      const message = "meedan-sync:: Promise not found";

      console.error(message);
      Sentry.captureMessage(message, "error");
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    const fallbackAlt =
      (
        parsed?.object?.data?.fields?.[0]?.value as string | undefined
      )?.trim() ??
      promise.title?.trim() ??
      promise.description?.trim() ??
      "Meedan promise image";

    let filePath: string | null = null;

    try {
      filePath = await downloadFile(imageUrl);

      const existingImageId = getRelationId(promise.image as unknown);
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
        const media = (await payload.create({
          collection: "media",
          data: {
            alt: fallbackAlt,
          },
          filePath,
        })) as Media;

        mediaId = getRelationId(media as unknown);
      }

      if (!mediaId) {
        Sentry.withScope((scope) => {
          scope.setTag("route", "meedan-sync");
          scope.setContext("promise", {
            id: promise.id,
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

      return NextResponse.json({ ok: true, updated: true }, { status: 200 });
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
