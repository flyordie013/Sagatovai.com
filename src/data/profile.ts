import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  profiles,
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  achievements,
  userAchievements,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { levelProgress, type LevelProgress } from "@/lib/leveling";
import { effectiveStreak } from "@/lib/streak";
import { courseVisibleToStudent } from "./course";
import { achievementUnlocked, countUnlockedAchievements } from "./achievements";

export interface ProfileCourse {
  title: string;
  slug: string;
  progress: number;
  total: number;
  done: number;
}

export interface ProfileAchievement {
  title: string;
  unlocked: boolean;
}

export interface ProfileData {
  profile: {
    fullName: string;
    email: string;
    avatarUrl: string | null;
    streak: number;
    longestStreak: number;
  } & LevelProgress;
  stats: {
    courses: number;
    lessonsCompleted: number;
    achievements: number;
  };
  courses: ProfileCourse[];
  topAchievements: ProfileAchievement[];
}

export async function getProfile(): Promise<ProfileData> {
  const db = await getDb();
  const { userId: uid } = await requireUser();

  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, uid))
    .limit(1);
  if (!p) throw new Error("Профиль не найден");

  const lp = levelProgress(p.xp);

  // Courses this student is enrolled in and still allowed to see (a draft the
  // owner opened for them counts; an archived course they paid for stays).
  const enrolled = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      accessType: enrollments.accessType,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, uid), courseVisibleToStudent()))
    .orderBy(courses.orderIndex);

  // Total lessons per course.
  const totals = await db
    .select({
      courseId: modules.courseId,
      total: sql<number>`count(${lessons.id})::int`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  const totalByCourse = new Map(totals.map((t) => [t.courseId, t.total]));

  // Completed lessons per course for this user.
  const completed = await db
    .select({
      courseId: modules.courseId,
      done: sql<number>`count(${lessonProgress.id})::int`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(and(eq(lessonProgress.userId, uid), eq(lessonProgress.completed, true)))
    .groupBy(modules.courseId);
  const doneByCourse = new Map(completed.map((c) => [c.courseId, c.done]));

  const courseList: ProfileCourse[] = enrolled.map((e) => {
    const total = totalByCourse.get(e.id) ?? 0;
    const done = e.accessType === "locked" ? 0 : doneByCourse.get(e.id) ?? 0;
    return {
      title: e.title,
      slug: e.slug,
      total,
      done,
      progress: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  });

  // Total completed lessons across all lessons.
  const [lessonsAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, uid), eq(lessonProgress.completed, true)));

  // Unlocked achievements count — same rule as the dashboard and /achievements.
  const achievementsUnlocked = await countUnlockedAchievements(uid);

  // Achievement catalog with unlock state for this user.
  const achRows = await db
    .select({
      title: achievements.title,
      unlockedAt: userAchievements.unlockedAt,
    })
    .from(achievements)
    .leftJoin(
      userAchievements,
      and(
        eq(userAchievements.achievementId, achievements.id),
        eq(userAchievements.userId, uid),
      ),
    )
    // Earned ones first — same rule as everywhere else, not a hand-written copy.
    .orderBy(
      desc(achievementUnlocked()),
      desc(userAchievements.unlockedAt),
      achievements.title,
    )
    .limit(6);

  const topAchievements: ProfileAchievement[] = achRows.map((a) => ({
    title: a.title,
    unlocked: a.unlockedAt != null,
  }));

  return {
    profile: {
      fullName: p.fullName,
      email: p.email,
      avatarUrl: p.avatarUrl,
      // The stored counter is stale until the next completed lesson rewrites
      // it — show 0 once the run is actually broken. `longestStreak` is a
      // record, so it keeps its value.
      streak: effectiveStreak(p.currentStreak, p.lastActivityAt),
      longestStreak: p.longestStreak,
      ...lp,
    },
    stats: {
      courses: enrolled.length,
      lessonsCompleted: lessonsAgg?.n ?? 0,
      achievements: achievementsUnlocked,
    },
    courses: courseList,
    topAchievements,
  };
}
