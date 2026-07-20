import { timingSafeEqual } from "node:crypto";

/**
 * In-memory abuse controls for inbound state-changing endpoints.
 *
 * These guards are per-process: in a multi-instance deployment each instance
 * enforces its own budget, so configure limits with that in mind (see
 * docs/remote-file-ingestion.md).
 */

/** Constant-time string comparison for secrets/tokens. */
export const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const MAX_TRACKED_KEYS = 10_000;

export type RateLimiter = {
  /** Returns true when the request is allowed, false when rate-limited. */
  allow: (key: string) => boolean;
};

/**
 * Fixed-window rate limiter. Windows are keyed per caller (IP/token) and
 * pruned lazily so the map stays bounded.
 */
export const createRateLimiter = ({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter => {
  const windows = new Map<string, { windowStart: number; count: number }>();

  const prune = (now: number) => {
    if (windows.size <= MAX_TRACKED_KEYS) {
      return;
    }
    for (const [key, entry] of windows) {
      if (now - entry.windowStart >= windowMs) {
        windows.delete(key);
      }
    }
  };

  return {
    allow: (key: string): boolean => {
      if (limit <= 0) {
        return true;
      }

      const now = Date.now();
      prune(now);

      const entry = windows.get(key);
      if (!entry || now - entry.windowStart >= windowMs) {
        windows.set(key, { windowStart: now, count: 1 });
        return true;
      }

      if (entry.count >= limit) {
        return false;
      }

      entry.count += 1;
      return true;
    },
  };
};

export type IdempotencyRecord = {
  status: number;
  body: Record<string, unknown>;
};

export type IdempotencyResult =
  | { state: "new" }
  | { state: "in-flight" }
  | { state: "replay"; record: IdempotencyRecord };

export type IdempotencyCache = {
  /**
   * Registers the key. "new" means the caller should process the request
   * and later call complete()/release(). "in-flight" means an identical
   * request is currently being processed. "replay" returns the recorded
   * response of an already-completed identical request.
   */
  begin: (key: string) => IdempotencyResult;
  /** Records the final response so later duplicates replay it. */
  complete: (key: string, record: IdempotencyRecord) => void;
  /** Drops an in-flight marker without recording a response (on failure). */
  release: (key: string) => void;
};

type IdempotencyEntry =
  | { state: "pending"; insertedAt: number }
  | { state: "done"; insertedAt: number; record: IdempotencyRecord };

/**
 * TTL cache keyed by a request fingerprint (e.g. SHA-256 of the raw body).
 * Completed requests replay their recorded response; identical concurrent
 * requests are rejected as in-flight duplicates.
 */
export const createIdempotencyCache = ({
  ttlMs,
  maxEntries = MAX_TRACKED_KEYS,
}: {
  ttlMs: number;
  maxEntries?: number;
}): IdempotencyCache => {
  const entries = new Map<string, IdempotencyEntry>();

  const prune = (now: number) => {
    for (const [key, entry] of entries) {
      if (now - entry.insertedAt >= ttlMs) {
        entries.delete(key);
      }
    }
    // Drop oldest entries when the cache is still over budget (Map preserves
    // insertion order).
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      entries.delete(oldestKey);
    }
  };

  return {
    begin: (key) => {
      const now = Date.now();
      prune(now);

      const entry = entries.get(key);
      if (entry && now - entry.insertedAt < ttlMs) {
        if (entry.state === "pending") {
          return { state: "in-flight" };
        }
        return { state: "replay", record: entry.record };
      }

      entries.set(key, { state: "pending", insertedAt: now });
      return { state: "new" };
    },
    complete: (key, record) => {
      entries.set(key, { state: "done", insertedAt: Date.now(), record });
    },
    release: (key) => {
      const entry = entries.get(key);
      if (entry?.state === "pending") {
        entries.delete(key);
      }
    },
  };
};

export type ConcurrencyGate = {
  /** Returns a release function when a slot is available, or null when saturated. */
  tryAcquire: () => (() => void) | null;
};

/** Bounds the number of simultaneously processed requests per process. */
export const createConcurrencyGate = (maxConcurrent: number): ConcurrencyGate => {
  let active = 0;

  return {
    tryAcquire: () => {
      if (maxConcurrent > 0 && active >= maxConcurrent) {
        return null;
      }

      active += 1;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          active -= 1;
        }
      };
    },
  };
};

export type ByteBudget = {
  /** Reserves bytes against the current window; false when over budget. */
  tryConsume: (bytes: number) => boolean;
};

/**
 * Rolling storage/cost budget: caps total accepted bytes per window
 * (default: per day) per process.
 */
export const createByteBudget = ({
  maxBytes,
  windowMs = 24 * 60 * 60 * 1000,
}: {
  maxBytes: number;
  windowMs?: number;
}): ByteBudget => {
  let windowStart = Date.now();
  let consumed = 0;

  return {
    tryConsume: (bytes: number): boolean => {
      if (maxBytes <= 0) {
        return true;
      }

      const now = Date.now();
      if (now - windowStart >= windowMs) {
        windowStart = now;
        consumed = 0;
      }

      if (consumed + bytes > maxBytes) {
        return false;
      }

      consumed += bytes;
      return true;
    },
  };
};
