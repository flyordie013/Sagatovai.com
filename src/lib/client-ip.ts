import "server-only";

/**
 * Best-effort client IP for rate-limiting, resistant to X-Forwarded-For
 * spoofing. XFF is `client, proxy1, proxy2, …` where each proxy APPENDS on the
 * right, so the leftmost entry is client-controlled and must not be trusted.
 *
 * We read the entry set by our own trusted reverse proxy: the Nth from the
 * right, where N = TRUSTED_PROXY_COUNT (default 1 — the single Caddy hop in
 * DEPLOY.md). With no proxy header at all, everything shares one bucket
 * ("local"), which is safe (more restrictive), not less.
 */
export function clientIp(xff: string | null | undefined): string {
  const parts = (xff ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "local";
  const count = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_COUNT ?? "1", 10) || 1);
  return parts[Math.max(0, parts.length - count)];
}
