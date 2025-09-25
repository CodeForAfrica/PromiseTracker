import { NextRequest, NextResponse } from "next/server";

import { fromUnixTime } from "date-fns";

import type { PublishedReport } from "@/lib/meedan";
import { syncMeedanReports } from "@/lib/syncMeedanReports";

const toNullableString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    return !["false", "0", ""].includes(normalised);
  }

  return Boolean(value);
};

const normaliseReport = (raw: unknown): PublishedReport | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const meedanId = toNullableString(data.meedanId ?? data.id);

  if (!meedanId) {
    return null;
  }

  const lastPublished = (() => {
    const raw = data.lastPublished ?? data.last_published;
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      return null;
    }
    return fromUnixTime(raw).toISOString();
  })();

  return {
    meedanId: meedanId.trim(),
    introduction: toNullableString(data.introduction),
    themeColor: toNullableString(data.themeColor ?? data.theme_color),
    statusLabel: toNullableString(data.statusLabel ?? data.status_label),
    status: toNullableString(data.status),
    image: toNullableString(data.image ?? data.imageUrl ?? data.image_url),
    title: toNullableString(data.title),
    headline: toNullableString(data.headline),
    text: toNullableString(data.text),
    description: toNullableString(data.description),
    publishedArticleUrl: toNullableString(
      data.publishedArticleUrl ?? data.published_article_url
    ),
    useVisualCard: toBoolean(data.useVisualCard ?? data.use_visual_card),
    state: toNullableString(data.state),
    lastPublished,
  } satisfies PublishedReport;
};

const normaliseInput = (input: unknown): unknown[] => {
  if (Array.isArray(input)) {
    return input;
  }

  if (input && typeof input === "object") {
    const data = input as Record<string, unknown>;
    if (Array.isArray(data.reports)) {
      return data.reports;
    }
    if (Array.isArray(data.promises)) {
      return data.promises;
    }
    if (Array.isArray(data.data)) {
      return data.data;
    }
  }

  return input == null ? [] : [input];
};

export const POST = async (request: NextRequest) => {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch (_error) {
    return NextResponse.json(
      {
        error: "Invalid JSON body",
      },
      { status: 400 }
    );
  }

  const entries = normaliseInput(parsed);
  const reports: PublishedReport[] = [];
  const invalidEntries: Array<{ index: number; reason: string }> = [];

  entries.forEach((entry, index) => {
    const report = normaliseReport(entry);
    if (!report) {
      invalidEntries.push({ index, reason: "Missing or invalid meedanId" });
      return;
    }
    reports.push(report);
  });

  if (reports.length === 0) {
    return NextResponse.json(
      {
        error: "No valid reports provided",
        invalidEntries,
      },
      { status: 400 }
    );
  }

  try {
    await syncMeedanReports({
      reports,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("meedan-sync:: Failed to process reports", error);
    return NextResponse.json(
      {
        error: "Failed to process reports",
      },
      { status: 500 }
    );
  }
};
