/**
 * GET /api/run-jobs
 *
 * Manually triggers the Payload job queue runner. This is useful when:
 *
 * - A workflow stalls or gets stuck and you need to nudge the runner without
 *   waiting for the next scheduled autoRun tick.
 * - The server restarted and scheduled jobs have not yet been picked up.
 * - You are debugging a specific queue and want an immediate execution cycle.
 * - The everyMinute cron has not fired yet after a fresh deploy.
 *
 * Query params (both optional; `all` takes precedence over `queue`):
 * - `queue`: run jobs from this queue instead of Payload's default `default`
 *   queue (e.g. `?queue=exportSync`).
 * - `all=true`: run jobs from every queue, ignoring `queue`.
 *
 * Security: requires an active Payload CMS session (i.e. the caller must be
 * logged in to the admin panel). Unauthenticated requests are rejected with
 * HTTP 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { getGlobalPayload } from "@/lib/payload";
import { PayloadRequest } from "payload";

export const GET = async (request: NextRequest) => {
  const payload = await getGlobalPayload();

  const { user } = await payload.auth({
    headers: request.headers,
    req: request as unknown as PayloadRequest,
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const allQueues = searchParams.get("all") === "true";
  const queue = searchParams.get("queue") || undefined;

  payload.jobs
    .run(allQueues ? { allQueues: true } : { queue })
    .catch((error: unknown) => {
      payload.logger.error({
        msg: "run-jobs:: Unhandled error in jobs.run()",
        allQueues,
        queue,
        error,
      });
    });

  return NextResponse.json(
    { ok: true, allQueues, queue: allQueues ? undefined : (queue ?? "default") },
    { status: 202 },
  );
};
