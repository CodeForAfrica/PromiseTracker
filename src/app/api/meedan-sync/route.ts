import { NextRequest, NextResponse } from "next/server";

import {
  mapPublishedReports,
  type PublishedReportsResponse,
} from "@/lib/meedan";
import { syncMeedanReports } from "@/lib/syncMeedanReports";
import { writeFileSync } from "node:fs";

const WEBHOOK_SECRET_ENV_KEY = "WEBHOOK_SECRET_KEY";

export const POST = async (request: NextRequest) => {
  const configuredSecret = process.env[WEBHOOK_SECRET_ENV_KEY];

  if (!configuredSecret) {
    console.error(
      "meedan-sync:: Missing WEBHOOK_SECRET_KEY environment variable"
    );
    return NextResponse.json(
      { error: "Service misconfigured" },
      { status: 500 }
    );
  }

  const providedSecret = request.headers.get("authorization")?.trim() ?? null;

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  // TODO: @kelvinkipruto remove this; only for testing
  writeFileSync(
    `Payload-${Date.now().toString()}.json`,
    JSON.stringify(parsed)
  );

  const reports = mapPublishedReports(
    (parsed ?? {}) as PublishedReportsResponse
  );

  if (reports.length === 0) {
    return NextResponse.json(
      {
        error: "No valid reports provided",
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
