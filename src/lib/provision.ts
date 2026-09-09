import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { missions, userMissions } from "@/db/schema";

/**
 * Gives a brand-new student the baseline every existing student already has,
 * so the app is never empty on first login:
 *   - the active missions — nothing else ever creates `user_missions`, so
 *     without this `completeLesson` would have nothing to advance.
 *
 * Idempotent: safe to call more than once for the same user.
 */
export async function provisionNewStudent(db: DB, userId: string): Promise<void> {
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
