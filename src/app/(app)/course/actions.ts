"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, enrollments, payments, profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { sendEmail, emailLayout } from "@/lib/email";
import { OWNER_NOTIFY_EMAIL } from "@/lib/contacts";
import { formatNumber } from "@/lib/utils";

export interface RequestResult {
  ok: boolean;
  error?: string;
  already?: boolean;
}

// Absolute link for the notification. Built from APP_URL (same source as
// metadataBase/robots), never from the request Host header.
const ADMIN_REQUESTS_URL = `${(process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "")}/admin/requests`;

/** Student-controlled values end up in this HTML — never interpolate them raw. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Student leaves a purchase request (lead) for a locked/paid course. */
export async function createPurchaseRequest(courseId: number): Promise<RequestResult> {
  const { userId } = await requireUser();
  const db = await getDb();

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

  const note = "Заявка из каталога";
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
        ["Контакт", student?.email || "—"],
        ["Курс", course.title],
        ["Стоимость", `${formatNumber(course.price)} ₸`],
        ["Комментарий", note],
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
