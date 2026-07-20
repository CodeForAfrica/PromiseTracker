import { describe, expect, it, vi } from "vitest";

import { checkMongo, checkTika, summarizeReadiness } from "@/lib/health";

const mongoPayload = (readyState: number, ping?: () => Promise<unknown>) => ({
  db: {
    connection: {
      readyState,
      db: {
        admin: () => ({
          command: ping ?? (() => Promise.resolve({ ok: 1 })),
        }),
      },
    },
  },
});

describe("checkMongo", () => {
  it("reports ok when connected and ping succeeds", async () => {
    const status = await checkMongo(mongoPayload(1));
    expect(status).toMatchObject({ name: "mongodb", ok: true, required: true });
  });

  it("reports not-ok when the connection is not ready", async () => {
    const status = await checkMongo(mongoPayload(0));
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/not ready/);
  });

  it("reports not-ok when there is no connection", async () => {
    const status = await checkMongo({ db: {} });
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/no mongoose connection/);
  });

  it("is bounded and fails when the ping hangs past the timeout", async () => {
    const hanging = () => new Promise(() => {});
    const status = await checkMongo(mongoPayload(1, hanging), 20);
    expect(status.ok).toBe(false);
    expect(status.durationMs).toBeLessThan(1_000);
  });
});

describe("checkTika", () => {
  it("is skipped and non-required when Tika is disabled", async () => {
    const status = await checkTika({ TIKA_ENABLED: "0" } as never);
    expect(status).toMatchObject({ name: "tika", ok: true, required: false });
  });

  it("reports ok when Tika responds 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const status = await checkTika(
      {
        TIKA_ENABLED: "1",
        AX_APACHE_TIKA_URL: "http://tika:9998/",
      } as never,
      2_000,
      fetchImpl as never,
    );
    expect(status).toMatchObject({ name: "tika", ok: true, required: true });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://tika:9998/tika",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reports not-ok when Tika responds non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const status = await checkTika(
      { TIKA_ENABLED: "1" } as never,
      2_000,
      fetchImpl as never,
    );
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/HTTP 503/);
  });

  it("reports not-ok when the Tika request rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const status = await checkTika(
      { TIKA_ENABLED: "1" } as never,
      2_000,
      fetchImpl as never,
    );
    expect(status.ok).toBe(false);
    expect(status.error).toMatch(/ECONNREFUSED/);
  });
});

describe("summarizeReadiness", () => {
  it("is ready when all required checks pass", () => {
    const summary = summarizeReadiness([
      { name: "mongodb", ok: true, required: true, durationMs: 1 },
      { name: "tika", ok: true, required: true, durationMs: 1 },
    ]);
    expect(summary).toMatchObject({ status: "ok", ready: true });
  });

  it("is unavailable when a required check fails", () => {
    const summary = summarizeReadiness([
      { name: "mongodb", ok: false, required: true, durationMs: 1 },
      { name: "tika", ok: true, required: true, durationMs: 1 },
    ]);
    expect(summary).toMatchObject({ status: "unavailable", ready: false });
  });

  it("stays ready when only a non-required check fails", () => {
    const summary = summarizeReadiness([
      { name: "mongodb", ok: true, required: true, durationMs: 1 },
      { name: "tika", ok: false, required: false, durationMs: 1 },
    ]);
    expect(summary.ready).toBe(true);
  });
});
