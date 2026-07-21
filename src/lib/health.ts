/**
 * Bounded health checks for the liveness and readiness endpoints.
 *
 * Liveness answers "is the process up?" and must never depend on external
 * services. Readiness answers "can this instance serve traffic right now?"
 * and checks the dependencies that are required to serve — MongoDB and (when
 * enabled) Apache Tika. Every dependency check is time-bounded so a hung
 * dependency can never hang the probe itself.
 */

export type DependencyStatus = {
  name: string;
  ok: boolean;
  required: boolean;
  durationMs: number;
  error?: string;
};

export const DEFAULT_HEALTH_TIMEOUT_MS = 2_000;

const withTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  // Race the operation against the deadline so a dependency that ignores the
  // AbortSignal (e.g. a hung driver call) still cannot outlast the timeout.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

const timed = async (
  name: string,
  required: boolean,
  check: () => Promise<void>,
): Promise<DependencyStatus> => {
  const startedAt = Date.now();
  try {
    await check();
    return { name, ok: true, required, durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      name,
      ok: false,
      required,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

type MongoPinger = {
  db?: {
    connection?: {
      readyState?: number;
      db?: { admin: () => { command: (cmd: Record<string, number>) => Promise<unknown> } };
    };
  };
};

/**
 * Pings MongoDB through the Payload mongoose connection. Bounded by
 * `timeoutMs`; a disconnected or unreachable database resolves to `ok: false`.
 */
export const checkMongo = (
  payload: MongoPinger,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
): Promise<DependencyStatus> =>
  timed("mongodb", true, async () => {
    const connection = payload.db?.connection;
    if (!connection) {
      throw new Error("no mongoose connection on payload adapter");
    }
    // 1 === connected (mongoose ConnectionStates).
    if (connection.readyState !== 1) {
      throw new Error(`mongoose connection not ready (state ${connection.readyState})`);
    }
    const admin = connection.db?.admin();
    if (!admin) {
      throw new Error("mongoose connection has no database handle");
    }
    await withTimeout(async () => {
      await admin.command({ ping: 1 });
    }, timeoutMs);
  });

/**
 * Checks Apache Tika readiness via an HTTP GET to its health path. Skipped
 * (reported ok, not required) when Tika is disabled via TIKA_ENABLED=0.
 */
export const checkTika = (
  env: NodeJS.ProcessEnv = process.env,
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<DependencyStatus> => {
  const enabled = env.TIKA_ENABLED !== "0";
  if (!enabled) {
    return Promise.resolve({
      name: "tika",
      ok: true,
      required: false,
      durationMs: 0,
    });
  }

  const baseUrl = env.AX_APACHE_TIKA_URL ?? "http://127.0.0.1:9998/";
  const healthPath = env.TIKA_HEALTH_PATH ?? "/tika";
  const url = new URL(healthPath, baseUrl).toString();

  return timed("tika", true, async () => {
    const response = await withTimeout(
      (signal) => fetchImpl(url, { method: "GET", signal }),
      timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`tika responded with HTTP ${response.status}`);
    }
  });
};

export const summarizeReadiness = (checks: DependencyStatus[]) => {
  const ready = checks.every((check) => check.ok || !check.required);
  return {
    status: ready ? ("ok" as const) : ("unavailable" as const),
    ready,
    checks,
  };
};
