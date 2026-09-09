"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  profiles,
  lessonProgress,
  missions,
  userMissions,
  achievements,
  userAchievements,
} from "@/db/schema";
import { requireUser, isStaff } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { levelForXp, rankForLevel, XP_PER_LESSON } from "@/lib/leveling";
import { calendarDayDiff } from "@/lib/streak";

export interface CompleteResult {
  ok: boolean;
  error?: string;
  alreadyCompleted?: boolean;
  xpEarned?: number;
  leveledUp?: boolean;
  newLevel?: number;
  newRank?: string;
  achievements?: string[];
  nextLessonId?: number | null;
}

/** Persist watched percentage (max wins). Called periodically by the player. */
export async function saveProgress(lessonId: number, pct: number): Promise<void> {
  const { userId, role } = await requireUser();
  // Reject writes unless the student has explicit course access (staff may preview).
  const info = await getLessonForStudent(lessonId, userId, isStaff(role));
  if (!info || !info.canView) return;
  const clamped = Math.min(100, Math.max(0, Math.round(pct)));
  const db = await getDb();
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, watchedPct: clamped })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: { watchedPct: sql`greatest(${lessonProgress.watchedPct}, ${clamped})`, updatedAt: new Date() },
    });
}

export async function completeLesson(lessonId: number): Promise<CompleteResult> {
  const { userId, role } = await requireUser();

  const info = await getLessonForStudent(lessonId, userId, isStaff(role));
  if (!info) return { ok: false, error: "Урок не найден" };
  if (!info.canView)
    return { ok: false, error: "Этот урок доступен после покупки курса" };
  if (info.completed)
    return { ok: true, alreadyCompleted: true, xpEarned: 0, nextLessonId: info.nextLessonId };
  // Completion is an optional progress marker and XP action. Watching a specific
  // percentage is deliberately not required; students choose their own order.

  const db = await getDb();
  const now = new Date();

  // 1) Atomically claim the completion. Ensure a row exists, then flip
  //    completed false→true in a single UPDATE guarded by completed=false.
  //    Only the request that wins the flip proceeds to award XP, so a
  //    double-submit / race can never grant rewards twice.
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, watchedPct: 100 })
    .onConflictDoNothing({ target: [lessonProgress.userId, lessonProgress.lessonId] });
  const claimed = await db
    .update(lessonProgress)
    .set({ watchedPct: 100, completed: true, completedAt: now, updatedAt: now })
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId),
        eq(lessonProgress.completed, false),
      ),
    )
    .returning({ id: lessonProgress.id });
  if (claimed.length === 0)
    return { ok: true, alreadyCompleted: true, xpEarned: 0, nextLessonId: info.nextLessonId };

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) return { ok: false, error: "Профиль не найден" };

  let xpGain = XP_PER_LESSON;

  // 2) advance active missions
  const active = await db
    .select({
      id: userMissions.id,
      current: userMissions.current,
      target: missions.target,
      reward: missions.xpReward,
    })
    .from(userMissions)
    .innerJoin(missions, eq(userMissions.missionId, missions.id))
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.completed, false),
        // A mission the owner switched off must stop paying out: the dashboard
        // already hides it, so its reward would be XP from nowhere.
        eq(missions.isActive, true),
      ),
    );

  for (const m of active) {
    const next = Math.min(m.current + 1, m.target);
    const done = next >= m.target;
    await db.update(userMissions).set({ current: next, completed: done }).where(eq(userMissions.id, m.id));
    if (done) xpGain += m.reward;
  }

  // 3) unlock lesson-count achievements
  const [{ c: totalCompleted }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)));

  const catalog = await db.select().from(achievements);
  // Earned = a ledger row that actually carries `unlockedAt`. A row without it
  // is progress only and must not count as unlocked, or the achievement would
  // be shut out forever.
  const ledger = await db
    .select({
      id: userAchievements.achievementId,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId));
  const earned = new Set(ledger.filter((r) => r.unlockedAt !== null).map((r) => r.id));

  const newlyUnlocked: string[] = [];
  for (const a of catalog) {
    // Compared against the CURRENT completed count, not just the moment the
    // target is crossed — an achievement the owner adds later is awarded to
    // students who are already past it instead of staying locked forever.
    if (earned.has(a.id) || a.target > totalCompleted) continue;
    // Insert, or claim a row that exists but was never unlocked. `setWhere`
    // keeps it race-safe: a concurrent request that already stamped
    // `unlockedAt` updates nothing and gets no row back, so XP is paid once.
    const ins = await db
      .insert(userAchievements)
      .values({ userId, achievementId: a.id, progress: a.target, unlockedAt: now })
      .onConflictDoUpdate({
        target: [userAchievements.userId, userAchievements.achievementId],
        set: { progress: a.target, unlockedAt: now },
        setWhere: isNull(userAchievements.unlockedAt),
      })
      .returning({ id: userAchievements.id });
    if (ins.length === 0) continue; // another request already unlocked it
    xpGain += a.xpReward;
    newlyUnlocked.push(a.title);
  }

  // 4) xp / level / rank
  const newXp = profile.xp + xpGain;
  const oldLevel = levelForXp(profile.xp);
  const newLevel = levelForXp(newXp);
  const newRank = rankForLevel(newLevel);

  // 5) streak — days are counted in Asia/Almaty, never in the process timezone
  //    (a UTC container would end the student's day at 05:00 local).
  let streak = profile.currentStreak;
  const diff = profile.lastActivityAt ? calendarDayDiff(profile.lastActivityAt, now) : null;
  if (diff === null || diff >= 2) streak = 1;
  else if (diff === 1) streak = profile.currentStreak + 1;
  // diff === 0 → same day, unchanged
  const longest = Math.max(profile.longestStreak, streak);

  await db
    .update(profiles)
    .set({
      xp: newXp,
      level: newLevel,
      rank: newRank,
      currentStreak: streak,
      longestStreak: longest,
      lastActivityAt: now,
    })
    .where(eq(profiles.id, userId));

  revalidatePath("/dashboard");

  return {
    ok: true,
    xpEarned: xpGain,
    leveledUp: newLevel > oldLevel,
    newLevel,
    newRank,
    achievements: newlyUnlocked,
    nextLessonId: info.nextLessonId,
  };
}
