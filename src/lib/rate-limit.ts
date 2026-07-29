import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter.
 * NOTE: per-process only (resets on restart, not shared across instances).
 * Replace with Redis/Upstash for multi-instance production.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Hard ceiling on tracked keys. Keys are attacker-influenced (one bucket per
 * ip+email pair), so the Map must never be allowed to grow without bound.
 */
const MAX_KEYS = 20_000;
/** Expired buckets are swept at most this often — one pass, not a timer. */
const SWEEP_MS = 60_000;

let lastSweepAt = 0;

/** Drops buckets whose window already closed. Cheap: runs once a minute. */
function sweep(now: number): void {
  if (now - lastSweepAt < SWEEP_MS) return;
  lastSweepAt = now;
  for (const [k, rec] of buckets) {
    if (rec.resetAt <= now) buckets.delete(k);
  }
}

/** Stores a fresh bucket, evicting the stalest one when the Map is full. */
function put(key: string, resetAt: number): void {
  if (buckets.size >= MAX_KEYS && !buckets.has(key)) {
    // Maps iterate in insertion order, so the head is the oldest window.
    for (const k of buckets.keys()) {
      buckets.delete(k);
      if (buckets.size < MAX_KEYS) break;
    }
  }
  buckets.set(key, { count: 1, resetAt });
}

export interface RateLimitOptions {
  /** Requests allowed per window for `key`. */
  max: number;
  windowMs: number;
  /**
   * Client IP. When given, the IP is limited across ALL of its keys as well —
   * without it, a narrow key like `login:ip:email` lets an attacker keep
   * hammering by rotating the email part.
   */
  ip?: string;
  /** Requests allowed per window for `ip` alone. Default: five windows' worth. */
  ipMax?: number;
}

export function rateLimit(
  key: string,
  { max, windowMs, ip, ipMax }: RateLimitOptions,
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  sweep(now);

  // [bucket key, its limit] — the IP-wide bucket rides along with `key`.
  const checks: [string, number][] = [[key, max]];
  if (ip) checks.push([`ip:${ip}`, ipMax ?? max * 5]);

  // Check every bucket BEFORE consuming: a request rejected by one bucket must
  // not burn quota in the other.
  for (const [k, limit] of checks) {
    const rec = buckets.get(k);
    if (rec && rec.resetAt > now && rec.count >= limit) {
      return { ok: false, retryAfterMs: rec.resetAt - now };
    }
  }
  for (const [k] of checks) {
    const rec = buckets.get(k);
    if (!rec || rec.resetAt <= now) put(k, now + windowMs);
    else rec.count += 1;
  }
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Clears one bucket (e.g. after a successful login). The IP-wide bucket is
 * deliberately left alone — otherwise one valid account would reset the cap
 * that limits guessing against every other account.
 */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
