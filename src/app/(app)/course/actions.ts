"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, enrollments, payments } from "@/db/schema";
import { requireUser } from "@/lib/session";

export interface RequestResult {
  ok: boolean;
  error?: string;
  already?: boolean;
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

  await db.insert(payments).values({
    userId,
    courseId,
    amount: course.price,
    status: "requested",
    method: "manual",
    note: "Заявка из каталога",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  return { ok: true };
}
