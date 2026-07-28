"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { setSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { provisionNewStudent } from "@/lib/provision";
import { MIN_PASSWORD } from "@/lib/auth-rules";

export interface RegisterState {
  error?: string;
}

/**
 * Self-service signup. Creates the profile, then gives the new student the
 * things every existing (seeded) student already has, so the app isn't empty
 * on first login: enrollment in every free published course and the active
 * missions (nothing else assigns missions, so without this they'd never
 * progress).
 */
export async function register(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const fullName = (formData.get("fullName") ?? "").toString().trim();
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  const confirm = (formData.get("confirm") ?? "").toString();

  if (!fullName || !email || !password) return { error: "Заполните все поля" };
  if (fullName.length > 120) return { error: "Слишком длинное имя" };
  if (email.length > 200 || !email.includes("@")) return { error: "Некорректный email" };
  if (password.length < MIN_PASSWORD)
    return { error: `Пароль должен быть не короче ${MIN_PASSWORD} символов` };
  if (password !== confirm) return { error: "Пароли не совпадают" };

  const h = await headers();
  const ip = clientIp(h.get("x-forwarded-for"));
  if (!rateLimit(`register:${ip}`, { max: 5, windowMs: 15 * 60_000 }).ok) {
    return { error: "Слишком много попыток. Попробуйте позже." };
  }

  const db = await getDb();

  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  if (existing) return { error: "Аккаунт с таким email уже существует" };

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    const [created] = await db
      .insert(profiles)
      .values({ fullName, email, passwordHash, role: "student" })
      .returning({ id: profiles.id });
    userId = created.id;
  } catch {
    // Unique-email race between the check above and the insert.
    return { error: "Аккаунт с таким email уже существует" };
  }

  await provisionNewStudent(db, userId);

  await setSession(userId, "student");
  redirect("/dashboard");
}
