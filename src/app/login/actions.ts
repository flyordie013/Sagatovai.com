"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/password";
import { setSession, clearSession } from "@/lib/session";
import { rateLimit, rateLimitReset } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import type { Role } from "@/lib/session-token";

export interface LoginState {
  error?: string;
}

// Computed once; equalizes login timing when the email doesn't exist.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  return (dummyHashPromise ??= hashPassword("no-such-user-timing-equalizer"));
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  if (!email || !password) return { error: "Введите email и пароль" };

  const h = await headers();
  const ip = clientIp(h.get("x-forwarded-for"));
  const key = `login:${ip}:${email}`;
  if (!rateLimit(key, { max: 8, windowMs: 5 * 60_000 }).ok) {
    return { error: "Слишком много попыток. Попробуйте через несколько минут." };
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);

  // Always run scrypt (dummy hash when no user / no hash) → no email-enumeration
  // timing oracle. Error text is identical for "no user" and "wrong password".
  const stored = user?.passwordHash || (await getDummyHash());
  const ok = await verifyPassword(password, stored);
  if (!user || !ok) return { error: "Неверный email или пароль" };

  rateLimitReset(key);
  await setSession(user.id, user.role as Role, user.sessionVersion);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
