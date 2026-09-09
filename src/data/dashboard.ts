import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  missions,
  userMissions,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { courseVisibleToStudent } from "./course";
import { countUnlockedAchievements } from "./achievements";
import { getCurrentUser } from "./user";
import type { CourseIcon, CourseSummary, DashboardData, Mission } from "@/types";

export async function getDashboard(): Promise<DashboardData> {
  const db = await getDb();
  const { userId: uid } = await requireUser();
  const user = await getCurrentUser();

  // Every course the student may see, with their enrollment attached when it
  // exists. A LEFT JOIN (not INNER) so courses the student hasn't bought yet
  // still show up in the catalog — otherwise a paid course would be
  // undiscoverable — and so `courseVisibleToStudent()` can read `access_type`.
  const enrolled = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
      icon: courses.icon,
      weeks: courses.weeks,
      rating: courses.rating,
      flagship: courses.flagship,
      price: courses.price,
      accessType: enrollments.accessType,
    })
    .from(courses)
    .leftJoin(
      enrollments,
      and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, uid)),
    )
    .where(courseVisibleToStudent())
    .orderBy(courses.orderIndex);

  const totals = await db
    .select({
      courseId: modules.courseId,
      total: sql<number>`count(${lessons.id})::int`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  const totalByCourse = new Map(totals.map((t) => [t.courseId, t.total]));

  const completed = await db
    .select({
      courseId: modules.courseId,
      done: sql<number>`count(${lessonProgress.id})::int`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(lessonProgress.userId, uid),
        eq(lessonProgress.completed, true),
      ),
    )
    .groupBy(modules.courseId);
  const doneByCourse = new Map(completed.map((c) => [c.courseId, c.done]));

  const courseList: CourseSummary[] = enrolled.map((e) => {
    const total = totalByCourse.get(e.id) ?? 0;
    const done = doneByCourse.get(e.id) ?? 0;
    // No enrollment row always means locked. Only an administrator grants access.
    const access = e.accessType === "full" ? "full" : "locked";
    const locked = access === "locked";
    return {
      id: e.id,
      slug: e.slug,
      title: e.title,
      description: e.description,
      weeks: e.weeks,
      lessons: total,
      rating: e.rating,
      progress: locked || total === 0 ? 0 : Math.round((done / total) * 100),
      access,
      flagship: e.flagship,
      icon: e.icon as CourseIcon,
    };
  });

  const totalLessons = courseList
    .filter((c) => c.access !== "locked")
    .reduce((sum, c) => sum + c.lessons, 0);
  const completedLessons = courseList
    .filter((c) => c.access !== "locked")
    .reduce((sum, c) => sum + (doneByCourse.get(c.id) ?? 0), 0);

  // Only a mission that is still active AND not finished. Never synthesize a
  // placeholder: a fake mission can't be advanced by any code path, so the card
  // would promise XP the platform never pays.
  const [um] = await db
    .select({
      id: userMissions.missionId,
      title: missions.title,
      description: missions.description,
      current: userMissions.current,
      target: missions.target,
      xpReward: missions.xpReward,
    })
    .from(userMissions)
    .innerJoin(missions, eq(userMissions.missionId, missions.id))
    .where(
      and(
        eq(userMissions.userId, uid),
        eq(userMissions.completed, false),
        eq(missions.isActive, true),
      ),
    )
    .limit(1);

  const mission: Mission | null = um ?? null;

  const achievementsUnlocked = await countUnlockedAchievements(uid);

  return {
    user,
    courses: courseList,
    mission,
    totalLessons,
    completedLessons,
    achievementsUnlocked,
  };
}
