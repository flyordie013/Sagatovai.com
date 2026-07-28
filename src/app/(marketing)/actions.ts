"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, leads } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

export interface LeadState {
  ok?: boolean;
  error?: string;
}

const MAX = { name: 120, contact: 120, comment: 1000 };

/**
 * Captures a lead from the PUBLIC storefront (visitor has no account yet).
 * Deliberately unauthenticated, so it is rate-limited by IP and every field is
 * length-capped. `courseId` is validated against published courses only.
 */
export async function submitLead(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const contact = (formData.get("contact") ?? "").toString().trim();
  const comment = (formData.get("comment") ?? "").toString().trim();
  const courseIdRaw = (formData.get("courseId") ?? "").toString().trim();

  if (!name || !contact) {
    return { error: "Укажите имя и контакт — телефон, WhatsApp или email." };
  }
  if (name.length > MAX.name || contact.length > MAX.contact) {
    return { error: "Слишком длинное значение в поле." };
  }
  if (comment.length > MAX.comment) {
    return { error: "Комментарий слишком длинный." };
  }

  const h = await headers();
  const ip = clientIp(h.get("x-forwarded-for"));
  if (!rateLimit(`lead:${ip}`, { max: 5, windowMs: 10 * 60_000 }).ok) {
    return { error: "Слишком много заявок. Попробуйте позже или напишите нам напрямую." };
  }

  const db = await getDb();

  // Only accept a course the visitor could actually have seen.
  let courseId: number | null = null;
  const parsed = Number.parseInt(courseIdRaw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    const [c] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(eq(courses.id, parsed), eq(courses.isPublished, true), eq(courses.isArchived, false)),
      )
      .limit(1);
    courseId = c?.id ?? null;
  }

  // Never let a DB hiccup take down the storefront's main conversion path.
  try {
    await db.insert(leads).values({ name, contact, comment, courseId });
  } catch (err) {
    console.error("[submitLead] insert failed:", err);
    return {
      error: "Не удалось отправить заявку. Попробуйте ещё раз или напишите нам напрямую.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  return { ok: true };
}
