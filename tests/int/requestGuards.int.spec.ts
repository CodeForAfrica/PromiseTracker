import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createByteBudget,
  createConcurrencyGate,
  createIdempotencyCache,
  createRateLimiter,
  safeCompare,
} from "@/utils/requestGuards";

afterEach(() => {
  vi.useRealTimers();
});

describe("safeCompare", () => {
  it("compares equal strings", () => {
    expect(safeCompare("secret-token", "secret-token")).toBe(true);
  });

  it("rejects different strings and lengths", () => {
    expect(safeCompare("secret-token", "secret-tokem")).toBe(false);
    expect(safeCompare("short", "longer-value")).toBe(false);
    expect(safeCompare("", "x")).toBe(false);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.allow("ip-1")).toBe(true);
    expect(limiter.allow("ip-1")).toBe(true);
    expect(limiter.allow("ip-1")).toBe(true);
    expect(limiter.allow("ip-1")).toBe(false);
    // Other callers are tracked independently.
    expect(limiter.allow("ip-2")).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.allow("ip-1")).toBe(true);
    expect(limiter.allow("ip-1")).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(limiter.allow("ip-1")).toBe(true);
  });
});

describe("createIdempotencyCache", () => {
  it("tracks new, in-flight, and replayed requests", () => {
    const cache = createIdempotencyCache({ ttlMs: 60_000 });

    expect(cache.begin("key-1")).toEqual({ state: "new" });
    expect(cache.begin("key-1")).toEqual({ state: "in-flight" });

    cache.complete("key-1", { status: 200, body: { ok: true } });

    expect(cache.begin("key-1")).toEqual({
      state: "replay",
      record: { status: 200, body: { ok: true } },
    });
  });

  it("re-admits a request after release (failed processing)", () => {
    const cache = createIdempotencyCache({ ttlMs: 60_000 });

    expect(cache.begin("key-1")).toEqual({ state: "new" });
    cache.release("key-1");
    expect(cache.begin("key-1")).toEqual({ state: "new" });
  });

  it("expires records after the TTL", () => {
    vi.useFakeTimers();
    const cache = createIdempotencyCache({ ttlMs: 1_000 });

    cache.begin("key-1");
    cache.complete("key-1", { status: 200, body: { ok: true } });

    vi.advanceTimersByTime(1_001);
    expect(cache.begin("key-1")).toEqual({ state: "new" });
  });

  it("evicts the oldest entries beyond maxEntries", () => {
    const cache = createIdempotencyCache({ ttlMs: 60_000, maxEntries: 2 });

    cache.begin("key-1");
    cache.complete("key-1", { status: 200, body: {} });
    cache.begin("key-2");
    cache.begin("key-3");

    // key-1 was evicted to stay within budget, so it is treated as new.
    expect(cache.begin("key-1")).toEqual({ state: "new" });
  });
});

describe("createConcurrencyGate", () => {
  it("bounds simultaneous holders and releases slots", () => {
    const gate = createConcurrencyGate(2);

    const first = gate.tryAcquire();
    const second = gate.tryAcquire();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(gate.tryAcquire()).toBeNull();

    first?.();
    expect(gate.tryAcquire()).not.toBeNull();
  });

  it("ignores double release", () => {
    const gate = createConcurrencyGate(1);
    const release = gate.tryAcquire();
    release?.();
    release?.();

    const again = gate.tryAcquire();
    expect(again).not.toBeNull();
    expect(gate.tryAcquire()).toBeNull();
  });
});

describe("createByteBudget", () => {
  it("caps consumption within the window", () => {
    const budget = createByteBudget({ maxBytes: 100 });

    expect(budget.tryConsume(60)).toBe(true);
    expect(budget.tryConsume(60)).toBe(false);
    expect(budget.tryConsume(40)).toBe(true);
    expect(budget.tryConsume(1)).toBe(false);
  });

  it("resets after the window", () => {
    vi.useFakeTimers();
    const budget = createByteBudget({ maxBytes: 100, windowMs: 1_000 });

    expect(budget.tryConsume(100)).toBe(true);
    expect(budget.tryConsume(1)).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(budget.tryConsume(100)).toBe(true);
  });
});
