import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  serializeSession,
  verifySessionToken,
  isStaff,
  type Role,
  type Session,
} from "./session-token";

export type { Session, Role };
export { isStaff };

/** Current session from the request cookie (server components / actions). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(userId: string, role: Role, sv = 0): Promise<void> {
  const exp = Date.now() + SESSION_MAX_AGE * 1000;
  const token = serializeSession({ userId, role, sv, exp });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Validates the cookie session against the DB (deleted profile / bumped
 * `sessionVersion`) and returns the fresh role. Wrapped in React `cache()` so
 * the multiple requireUser/requireStaff/getCurrentUser calls in a single render
 * share ONE query instead of each hitting the DB.
 */
const authenticate = cache(
  async (): Promise<Session | "no-session" | "revoked"> => {
    const session = await getSession();
    if (!session) return "no-session";

    const db = await getDb();
    const [p] = await db
      .select({ role: profiles.role, sv: profiles.sessionVersion })
      .from(profiles)
      .where(eq(profiles.id, session.userId))
      .limit(1);

    if (!p || p.sv !== session.sv) return "revoked"; // deleted profile or revoked
    return { userId: session.userId, role: p.role, sv: p.sv };
  },
);

/**
 * Require any authenticated user. Authoritative gate: a deleted profile, a role
 * change, or a bumped `sessionVersion` (password changed elsewhere → revoked)
 * takes effect immediately, rather than trusting the up-to-7-day-stale cookie.
 */
export async function requireUser(): Promise<Session> {
  const r = await authenticate();
  if (r === "no-session") redirect("/login");
  if (r === "revoked") redirect("/logout"); // clear the stale cookie & re-login
  return r;
}

/** Require staff (admin/superadmin). Builds on the DB-backed requireUser. */
export async function requireStaff(): Promise<Session> {
  const session = await requireUser();
  if (!isStaff(session.role)) redirect("/dashboard");
  return session;
}
