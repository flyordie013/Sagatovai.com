import "server-only";

/**
 * Minimal in-memory fixed-window rate limiter.
 * NOTE: per-process only (resets on restart, not shared across instances).
 * Replace with Redis/Upstash for multi-instance production.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const rec = buckets.get(key);

  if (!rec || rec.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (rec.count >= max) {
    return { ok: false, retryAfterMs: rec.resetAt - now };
  }
  rec.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
