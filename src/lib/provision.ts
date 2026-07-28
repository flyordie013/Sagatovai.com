import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import { courses, enrollments, missions, userMissions } from "@/db/schema";

/**
 * Gives a brand-new student the baseline every existing student already has,
 * so the app is never empty on first login:
 *   - full access to every free published course (the tripwire funnel)
 *   - the active missions — nothing else ever creates `user_missions`, so
 *     without this `completeLesson` would have nothing to advance.
 *
 * Idempotent: safe to call more than once for the same user.
 */
export async function provisionNewStudent(db: DB, userId: string): Promise<void> {
  const freeCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(eq(courses.isPublished, true), eq(courses.isArchived, false), eq(courses.price, 0)),
    );
  if (freeCourses.length > 0) {
    await db
      .insert(enrollments)
      .values(freeCourses.map((c) => ({ userId, courseId: c.id, accessType: "full" as const })))
      .onConflictDoNothing();
  }

  const activeMissions = await db
    .select({ id: missions.id })
    .from(missions)
    .where(eq(missions.isActive, true));
  if (activeMissions.length > 0) {
    await db
      .insert(userMissions)
      .values(activeMissions.map((m) => ({ userId, missionId: m.id })))
      .onConflictDoNothing();
  }
}
