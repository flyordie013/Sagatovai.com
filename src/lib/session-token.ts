import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure, stateless session token (HMAC-signed cookie value).
 * No `next/headers` here so it is safe to import from `proxy.ts`.
 */
export const SESSION_COOKIE = "oqu_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days (seconds)

export type Role = "student" | "curator" | "admin" | "superadmin";
export interface Session {
  userId: string;
  role: Role;
  /** Session version at issue time; compared to the DB to detect revocation. */
  sv: number;
}
interface Payload extends Session {
  exp: number; // ms epoch
}

const rawSecret = process.env.AUTH_SECRET;
if (!rawSecret && process.env.NODE_ENV === "production") {
  // Never fall back to a public constant in production — that would let anyone
  // forge a superadmin token. Fail loudly instead.
  throw new Error("AUTH_SECRET is required in production");
}
const SECRET = rawSecret ?? "dev-insecure-secret-change-me-in-production";

const VALID_ROLES: Role[] = ["student", "curator", "admin", "superadmin"];

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("base64url");
}

export function serializeSession(payload: Payload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Verify signature + expiry. Returns the session or null. Safe for proxy. */
export function verifySessionToken(token: string | undefined | null): Session | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Payload;
    if (!payload.userId || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    if (!VALID_ROLES.includes(payload.role)) return null;
    // Tokens issued before session versioning have no `sv` → treat as 0 so they
    // stay valid against the default DB value (no forced re-login on deploy).
    const sv = typeof payload.sv === "number" ? payload.sv : 0;
    return { userId: payload.userId, role: payload.role, sv };
  } catch {
    return null;
  }
}

export function isStaff(role: Role | undefined | null): boolean {
  return role === "admin" || role === "superadmin";
}
