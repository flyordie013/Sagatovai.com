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
import { formatNumber } from "@/lib/utils";

export interface RequestResult {
  ok: boolean;
  error?: string;
  already?: boolean;
}

const ADMIN_REQUESTS_URL = `${(process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "")}/admin/requests`;

/** Save intent only. Access is granted exclusively by an administrator. */
export async function createPurchaseRequest(courseId: number): Promise<RequestResult> {
  const { userId } = await requireUser();
  const db = await getDb();

  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return { ok: false, error: "Курс не найден" };
  if (!course.isPublished || course.isArchived)
    return { ok: false, error: "Курс недоступен" };

  const [enrollment] = await db
    .select({ access: enrollments.accessType })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  if (enrollment?.access === "full") return { ok: true, already: true };

  const created = await db.transaction(async (tx) => {
    const [current] = await tx.select({ id: courses.id }).from(courses).where(and(eq(courses.id, courseId), eq(courses.isPublished, true), eq(courses.isArchived, false))).for("update");
    if (!current) return "unavailable";
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for("update");
    const [owned] = await tx.select({ access: enrollments.accessType }).from(enrollments).where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    if (owned?.access === "full") return "existing";
    const [existing] = await tx.select({ id: payments.id }).from(payments)
      .where(and(eq(payments.userId, userId), eq(payments.courseId, courseId), eq(payments.status, "requested"))).limit(1);
    if (existing) return "existing";
    if (!rateLimit(`course-request:${userId}`, { max: 5, windowMs: 60 * 60_000 }).ok) return "limited";
    await tx.insert(payments).values({ userId, courseId, amount: course.price, status: "requested", method: "manual",
      note: "Заявка из каталога. Доступ выдаёт администратор после проверки оплаты." });
    return "created";
  });
  if (created === "unavailable") return { ok: false, error: "Курс недоступен" };
  if (created === "existing") return { ok: true, already: true };
  if (created === "limited") return { ok: false, error: "Слишком много заявок. Попробуйте позже." };

  after(async () => {
    try {
      const [student] = await db
        .select({ name: profiles.fullName, email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      const fields: [string, string][] = [
        ["Имя", student?.name || "—"],
        ["Email", student?.email || "—"],
        ["Курс", course.title],
        ["Стоимость", `${formatNumber(course.price)} ₸`],
        ["Статус", "Ожидает проверки оплаты и выдачи доступа"],
      ];

      await sendEmail({
        to: OWNER_NOTIFY_EMAIL,
        subject: `Запрос доступа к курсу — ${course.title}`,
        text: `${fields.map(([key, value]) => `${key}: ${value}`).join("\n")}\n\nВсе запросы: ${ADMIN_REQUESTS_URL}`,
        html: emailLayout(
          "Запрос доступа к курсу",
          `${fields
            .map(
              ([key, value]) =>
                `<p style="margin:0 0 10px"><strong style="color:#f4f2ec">${key}:</strong> ${esc(value)}</p>`,
            )
            .join("")}
           <p style="margin:20px 0 0"><a href="${ADMIN_REQUESTS_URL}" style="display:inline-block;background:#f5a524;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Открыть запросы</a></p>`,
        ),
      });
    } catch (error) {
      console.error("[createPurchaseRequest] owner notification failed:", error);
    }
  });

  revalidatePath("/dashboard");
  revalidatePath(`/course/${course.slug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  return { ok: true };
}
