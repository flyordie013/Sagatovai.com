"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, enrollments, payments, profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail, emailLayout, escapeHtml as esc } from "@/lib/email";
import { OWNER_NOTIFY_EMAIL } from "@/lib/contacts";
import { isPaymentConfigured } from "@/lib/payment";
import { formatNumber } from "@/lib/utils";

export interface RequestResult {
  ok: boolean;
  error?: string;
  already?: boolean;
}

/** Max length kept for the contact the student types in (WhatsApp / phone). */
const MAX_CONTACT = 64;

// Absolute link for the notification. Built from APP_URL (same source as
// metadataBase/robots), never from the request Host header.
const ADMIN_REQUESTS_URL = `${(process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "")}/admin/requests`;


/**
 * Normalizes the contact the student typed: one line, no runs of spaces, capped.
 * Deliberately NOT format-validated — a number in an unexpected shape is still
 * a way to reach the student, and a rejected request is a lost sale.
 */
function cleanContact(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CONTACT);
}

/**
 * Student leaves a purchase request (lead) for a locked/paid course.
 *
 * @param contact - optional WhatsApp/phone the student typed. Profiles carry no
 *   phone, so without this the owner can only reach them by email — which is
 *   the weaker channel here and stays silent until mail is configured.
 */
export async function createPurchaseRequest(
  courseId: number,
  contact = "",
): Promise<RequestResult> {
  const { userId } = await requireUser();
  const db = await getDb();
  const waContact = cleanContact(contact);

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return { ok: false, error: "Курс не найден" };
  // Don't accept leads for courses students can't actually see.
  if (!course.isPublished || course.isArchived)
    return { ok: false, error: "Курс недоступен" };

  const [enr] = await db
    .select({ a: enrollments.accessType })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (enr?.a === "full") return { ok: true, already: true };

  // One open request per student per course. A second click (or a return to the
  // page, where the button re-appears until the data refreshes) reports success
  // without inserting a duplicate row for the owner to sort out.
  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.courseId, courseId),
        eq(payments.status, "requested"),
      ),
    )
    .limit(1);
  if (existing) return { ok: true, already: true };

  // Only real inserts are metered — the idempotent paths above must keep
  // answering, or a student returning to the page would see an error instead of
  // their own open request. Keyed by the session userId (server-side, can't be
  // forged), so a declined request can't be re-sent in a loop and a scripted
  // click can't email the owner once per course.
  if (!rateLimit(`course-request:${userId}`, { max: 5, windowMs: 60 * 60_000 }).ok) {
    return {
      ok: false,
      error: "Слишком много заявок. Попробуйте позже или напишите нам в WhatsApp.",
    };
  }

  // Tells the owner which ending the student actually saw, so they know whether
  // to expect a receipt or to make the first move themselves. The contact rides
  // along in the same column — `note` is the only free-form field on payments.
  const context = isPaymentConfigured
    ? "Заявка из каталога. Студенту показаны сумма и реквизиты — ожидаем чек."
    : "Заявка из каталога";
  const note = waContact ? `${context} · WhatsApp: ${waContact}` : context;
  await db.insert(payments).values({
    userId,
    courseId,
    amount: course.price,
    status: "requested",
    method: "manual",
    note,
  });

  // Ping the owner AFTER the response: looking the student up and talking to
  // the mail provider must not slow the button down, and a mail outage must
  // never turn a saved request into an error on screen.
  after(async () => {
    try {
      const [student] = await db
        .select({ name: profiles.fullName, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      const fields: [string, string][] = [
        ["Имя", student?.name || "—"],
        ["WhatsApp", waContact || "не указан"],
        ["Email", student?.email || "—"],
        ["Курс", course.title],
        ["Стоимость", `${formatNumber(course.price)} ₸`],
        ["Комментарий", context],
      ];

      await sendEmail({
        to: OWNER_NOTIFY_EMAIL,
        subject: `Запрос доступа к курсу — ${course.title}`,
        text: `${fields.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nВсе запросы: ${ADMIN_REQUESTS_URL}`,
        html: emailLayout(
          "Запрос доступа к курсу",
          `${fields
            .map(
              ([k, v]) =>
                `<p style="margin:0 0 10px"><strong style="color:#f4f2ec">${k}:</strong> ${esc(v)}</p>`,
            )
            .join("")}
           <p style="margin:20px 0 0"><a href="${ADMIN_REQUESTS_URL}" style="display:inline-block;background:#f5a524;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Открыть запросы</a></p>`,
        ),
      });
    } catch (err) {
      console.error("[createPurchaseRequest] owner notification failed:", err);
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  return { ok: true };
}
