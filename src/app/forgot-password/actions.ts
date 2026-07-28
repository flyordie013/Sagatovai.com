"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, passwordResets } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { sendEmail, emailLayout } from "@/lib/email";
import { MIN_PASSWORD } from "@/lib/auth-rules";

export interface ForgotState {
  ok?: boolean;
  error?: string;
}
export interface ResetState {
  error?: string;
}

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Base URL for the reset link. NEVER derived from the request Host in
 * production (that would allow host-header poisoning → the token in a genuine
 * email points at an attacker's domain). Requires APP_URL in prod; falls back
 * to the request host only in development.
 */
function resetBaseUrl(host: string | null): string | null {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null; // fail closed
  return `http://${host ?? "localhost:3000"}`;
}

/**
 * Starts a password reset. ALWAYS returns the same neutral success — never
 * reveals whether an email is registered (anti-enumeration). Rate-limited by IP.
 */
export async function requestReset(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = (formData.get("email") ?? "").toString().trim().toLowerCase();
  if (!email || !email.includes("@")) return { error: "Введите корректный email" };

  const h = await headers();
  if (!rateLimit(`forgot:${clientIp(h.get("x-forwarded-for"))}`, { max: 5, windowMs: 15 * 60_000 }).ok) {
    return { error: "Слишком много попыток. Попробуйте позже." };
  }
  const base = resetBaseUrl(h.get("host"));

  // The account lookup, token creation, and email all happen AFTER the response
  // is sent — so an existing and a non-existent email take the same time on the
  // request path (no timing oracle), and the response is always the same body.
  after(async () => {
    if (!base) {
      console.error("[forgot] APP_URL is not set in production — reset email not sent.");
      return;
    }
    const db = await getDb();
    // Opportunistic cleanup so the table never grows unbounded.
    await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date()));

    const [user] = await db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);
    if (!user) return;

    // A new request invalidates the user's previous (unused) tokens.
    await db.delete(passwordResets).where(eq(passwordResets.userId, user.id));

    const token = randomBytes(32).toString("hex");
    await db.insert(passwordResets).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });

    const link = `${base}/reset-password/${token}`;
    await sendEmail({
      to: email,
      subject: "Восстановление пароля — OQU",
      text: `Чтобы задать новый пароль, откройте ссылку (действует 1 час):\n${link}\n\nЕсли вы не запрашивали сброс — просто проигнорируйте письмо.`,
      html: emailLayout(
        "Восстановление пароля",
        `<p>Здравствуйте${user.name ? `, ${user.name.split(" ")[0]}` : ""}!</p>
         <p>Вы запросили сброс пароля. Ссылка действует 1 час:</p>
         <p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:#f5a524;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Задать новый пароль</a></p>
         <p style="color:#6b6b76;font-size:13px">Если вы не запрашивали сброс — просто проигнорируйте это письмо.</p>`,
      ),
    });
  });

  // Always the same neutral response, returned immediately.
  return { ok: true };
}

/** Completes a reset: validates the token, sets the new password, burns the token. */
export async function resetPassword(
  token: string,
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const password = (formData.get("password") ?? "").toString();
  const confirm = (formData.get("confirm") ?? "").toString();

  if (password.length < MIN_PASSWORD)
    return { error: `Пароль должен быть не короче ${MIN_PASSWORD} символов` };
  if (password !== confirm) return { error: "Пароли не совпадают" };
  if (!token) return { error: "Ссылка недействительна" };

  const db = await getDb();
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(token)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return { error: "Ссылка недействительна или истекла. Запросите новую." };

  // Bump sessionVersion so any existing sessions are revoked (the user will log
  // in fresh below), then mark the token used.
  const passwordHash = await hashPassword(password);
  await db
    .update(profiles)
    .set({ passwordHash, sessionVersion: sql`${profiles.sessionVersion} + 1` })
    .where(eq(profiles.id, row.userId));
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, row.id));

  redirect("/login?reset=1"); // never returns
}
