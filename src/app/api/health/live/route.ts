/**
 * GET /api/health/live — liveness probe.
 *
 * Answers only "is the Node process up and serving?". It deliberately does
 * NOT touch MongoDB, Tika, or any other dependency, so a dependency outage
 * can never cause the orchestrator to kill an otherwise-healthy process.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = () =>
  NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
