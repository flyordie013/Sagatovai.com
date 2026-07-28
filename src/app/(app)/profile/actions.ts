"use server";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { verifyPassword, hashPassword } from "@/lib/password";
import { requireUser, setSession } from "@/lib/session";

export interface PasswordState {
  error?: string;
  success?: string;
}

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const { userId, role } = await requireUser();

  const current = (formData.get("current") ?? "").toString();
  const next = (formData.get("next") ?? "").toString();
  const confirm = (formData.get("confirm") ?? "").toString();

  if (!current || !next || !confirm) {
    return { error: "Заполните все поля" };
  }
  if (next.length < 8) {
    return { error: "Новый пароль должен быть не короче 8 символов" };
  }
  if (next !== confirm) {
    return { error: "Пароли не совпадают" };
  }

  const db = await getDb();
  const [user] = await db
    .select({ passwordHash: profiles.passwordHash })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!user) {
    return { error: "Профиль не найден" };
  }

  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) {
    return { error: "Текущий пароль неверен" };
  }

  if (await verifyPassword(next, user.passwordHash)) {
    return { error: "Новый пароль совпадает с текущим" };
  }

  // Bump sessionVersion → every OTHER existing session for this user is
  // revoked. Re-issue THIS session with the new version so the current device
  // stays logged in.
  const passwordHash = await hashPassword(next);
  const [updated] = await db
    .update(profiles)
    .set({ passwordHash, sessionVersion: sql`${profiles.sessionVersion} + 1` })
    .where(eq(profiles.id, userId))
    .returning({ sv: profiles.sessionVersion });
  if (updated) await setSession(userId, role, updated.sv);

  return { success: "Пароль обновлён. Другие сессии завершены." };
}
