import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { achievements, userAchievements, lessonProgress } from "@/db/schema";

/**
 * THE rule for «достижение получено»: a `user_achievements` row counts only
 * when it carries `unlockedAt`. A row without it is progress-in-flight —
 * completeLesson() writes and re-claims such rows — so counting every row would
 * hand out badges the student hasn't earned. Everything that answers this
 * question (dashboard, profile, achievements page) goes through here.
 *
 * The query must have `user_achievements` in scope, filtered by the user.
 */
export function achievementUnlocked() {
  return isNotNull(userAchievements.unlockedAt);
}

/** How many achievements the student has actually earned. */
export async function countUnlockedAchievements(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), achievementUnlocked()));
  return row?.n ?? 0;
}

export interface AchievementItem {
  code: string;
  title: string;
  description: string;
  target: number;
  xpReward: number;
  unlocked: boolean;
  progress: number;
}

export interface AchievementsData {
  items: AchievementItem[];
  unlockedCount: number;
  total: number;
}

/**
 * Achievements are currently keyed on the number of COMPLETED lessons.
 * `unlocked` is the source-of-truth ledger (user_achievements, written by
 * completeLesson / seed); `progress` (for locked bars) = min(completed, target).
 */
export async function getAchievements(userId: string): Promise<AchievementsData> {
  const db = await getDb();

  const [doneRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .where(
      and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)),
    );
  const completedLessons = doneRow?.n ?? 0;

  const ledger = await db
    .select({ id: userAchievements.achievementId })
    .from(userAchievements)
    .where(and(eq(userAchievements.userId, userId), achievementUnlocked()));
  const unlockedIds = new Set(ledger.map((r) => r.id));

  const catalog = await db
    .select({
      id: achievements.id,
      code: achievements.code,
      title: achievements.title,
      description: achievements.description,
      target: achievements.target,
      xpReward: achievements.xpReward,
    })
    .from(achievements)
    .orderBy(achievements.target, achievements.code);

  const items: AchievementItem[] = catalog.map((a) => {
    const target = Math.max(1, a.target);
    return {
      code: a.code,
      title: a.title,
      description: a.description,
      target,
      xpReward: a.xpReward,
      progress: Math.min(completedLessons, target),
      unlocked: unlockedIds.has(a.id),
    };
  });

  const unlockedCount = items.filter((i) => i.unlocked).length;

  return { items, unlockedCount, total: items.length };
}
