/**
 * GET /api/health/ready — readiness probe.
 *
 * Answers "can this instance serve traffic right now?" by checking the
 * dependencies required to serve: MongoDB and (when enabled) Apache Tika.
 * Each check is time-bounded. Returns 200 when ready, 503 otherwise, so
 * Dokku/Docker probes hold traffic off an instance that cannot serve.
 */
import { NextResponse } from "next/server";
import { getGlobalPayload } from "@/lib/payload";
import { checkMongo, checkTika, summarizeReadiness } from "@/lib/health";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = async () => {
  const checks = [];

  try {
    const payload = await getGlobalPayload();
    checks.push(await checkMongo(payload as never));
  } catch (error) {
    checks.push({
      name: "mongodb",
      ok: false,
      required: true,
      durationMs: 0,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  checks.push(await checkTika());

  const summary = summarizeReadiness(checks);

  return NextResponse.json(summary, {
    status: summary.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
};
