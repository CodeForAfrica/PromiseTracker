import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";

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

export const POST = async (request: NextRequest) => {
  const configuredSecret = process.env[WEBHOOK_SECRET_ENV_KEY];

  if (!configuredSecret) {
    console.error(
      "meedan-sync:: Missing WEBHOOK_SECRET_KEY environment variable"
    );
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const meedanId = normaliseString(parsed?.data?.id);

  if (!meedanId) {
    return NextResponse.json(
      {
        error: "Missing Meedan ID",
      },
      { status: 400 }
    );
  }

  const imageUrl = normaliseString(parsed?.object?.file?.[0]?.url ?? null);

  if (!imageUrl) {
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
      return NextResponse.json({ error: "Promise not found" }, { status: 404 });
    }

    if (promise.imageUrl?.trim() === imageUrl) {
      return NextResponse.json({ ok: true, updated: false }, { status: 200 });
    }

    const fallbackAlt =
      (
        parsed?.object?.data?.fields?.[0]?.value as string | undefined
      )?.trim() ??
      promise.title?.trim() ??
      promise.headline?.trim() ??
      "Meedan promise image";

    let filePath: string | null = null;

    try {
      filePath = await downloadFile(imageUrl);

      const media = (await payload.create({
        collection: "media",
        data: {
          alt: fallbackAlt,
        },
        filePath,
      })) as Media;

      const mediaId =
        typeof media?.id === "string"
          ? media.id
          : typeof media?.id === "number"
            ? String(media.id)
            : null;

      if (!mediaId) {
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
          imageUrl,
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
        }
      }
    }
  } catch (error) {
    console.error("meedan-sync:: Failed to process webhook", error);
    return NextResponse.json(
      { ok: false, updated: false, error: "Failed to process webhook" },
      { status: 200 }
    );
  }
};
