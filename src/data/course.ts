import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  payments,
} from "@/db/schema";

export type CourseAccess = "full" | "trial" | "locked" | "none";

/** Effective course access. Only staff or an explicit enrollment may read lessons. */
async function accessFor(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  course: { id: number },
  staff: boolean,
): Promise<CourseAccess> {
  if (staff) return "full";
  const [e] = await db
    .select({ a: enrollments.accessType })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, course.id)))
    .limit(1);
  return e?.a ?? "none";
}

/** A course nobody is enrolled in is invisible until it's published. */
function hiddenFromStudent(
  course: { isPublished: boolean; isArchived: boolean },
  access: CourseAccess,
): boolean {
  return (!course.isPublished || course.isArchived) && !hasCourseAccess(access);
}

/**
 * The same rule as `hiddenFromStudent`, but as a WHERE condition for course
 * LISTS: a course belongs in a student's catalog when it's publicly released
 * OR the student holds a real enrollment. Filtering on `is_published` alone
 * hides a draft the owner granted access to, and drops a course out of paying
 * students' accounts the moment it's archived.
 *
 * The query must join `enrollments` scoped to that student. With a LEFT JOIN a
 * missing row leaves `access_type` NULL, which is never `<> 'locked'`.
 */
export function courseVisibleToStudent() {
  return or(
    and(eq(courses.isPublished, true), eq(courses.isArchived, false)),
    eq(enrollments.accessType, "full"),
  );
}

/** Ordered lessons of a course (by module order, then lesson order). */
async function orderedLessons(db: Awaited<ReturnType<typeof getDb>>, courseId: number) {
  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      moduleId: lessons.moduleId,
      moduleOrder: modules.orderIndex,
      order: lessons.orderIndex,
      duration: lessons.videoDurationSec,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex));
}

async function completedIds(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  lessonIds: number[],
): Promise<Set<number>> {
  if (lessonIds.length === 0) return new Set();
  const rows = await db
    .select({ id: lessonProgress.lessonId })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.completed, true),
        inArray(lessonProgress.lessonId, lessonIds),
      ),
    );
  return new Set(rows.map((r) => r.id));
}

export interface StudentLesson {
  id: number;
  title: string;
  duration: number;
  completed: boolean;
  /** Every lesson is playable as soon as the administrator grants course access. */
  playable: boolean;
}

/** Owning the course (paid or trial) opens every lesson. */
export function hasCourseAccess(access: CourseAccess): boolean {
  return access === "full";
}

export async function getCourseForStudent(slug: string, userId: string, staff = false) {
  const db = await getDb();

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  if (!course) return null;

  const access = await accessFor(db, userId, course, staff);
  // Draft/archived courses are 404 for everyone except enrolled students.
  if (hiddenFromStudent(course, access)) return null;

  const [openRequest] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        eq(payments.courseId, course.id),
        eq(payments.status, "requested"),
      ),
    )
    .limit(1);

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.orderIndex));

  const ordered = await orderedLessons(db, course.id);
  const done = await completedIds(db, userId, ordered.map((l) => l.id));

  const owns = hasCourseAccess(access);

  const byModule = new Map<number, StudentLesson[]>();
  for (const l of ordered) {
    const list = byModule.get(l.moduleId) ?? [];
    list.push({
      id: l.id,
      title: l.title,
      duration: l.duration,
      completed: done.has(l.id),
      playable: owns,
    });
    byModule.set(l.moduleId, list);
  }

  const [recent] = owns && ordered.length ? await db.select({ id: lessonProgress.lessonId })
    .from(lessonProgress).where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, ordered.map(l => l.id)), isNotNull(lessonProgress.positionUpdatedAt)))
    .orderBy(desc(lessonProgress.positionUpdatedAt)).limit(1) : [];
  const nextLesson = owns ? recent ?? ordered.find((l) => !done.has(l.id)) ?? ordered[0] : undefined;

  return {
    course,
    access,
    owns,
    requested: Boolean(openRequest),
    totalLessons: ordered.length,
    completedLessons: done.size,
    // The whole course is finished (only meaningful for an owner).
    courseCompleted: owns && ordered.length > 0 && done.size >= ordered.length,
    nextLessonId: nextLesson?.id ?? null,
    modules: mods.map((m) => ({ id: m.id, title: m.title, lessons: byModule.get(m.id) ?? [] })),
  };
}

export interface CourseSuggestion {
  slug: string;
  title: string;
  description: string;
  price: number;
  weeks: number;
}

/**
 * The next course to offer a student who just finished one — the moment they
 * are most likely to buy again, instead of the current dead end.
 *
 * Only published, non-archived, paid courses without an enrollment are offered.
 * Ordering follows the owner's catalog order, flagship first.
 */
export async function getNextCourseSuggestion(
  userId: string,
  excludeCourseId: number,
): Promise<CourseSuggestion | null> {
  const db = await getDb();
  const [next] = await db
    .select({
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
      price: courses.price,
      weeks: courses.weeks,
    })
    .from(courses)
    // LEFT JOIN scoped to this student: a missing row leaves `id` NULL, which is
    // exactly "not enrolled".
    .leftJoin(
      enrollments,
      and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)),
    )
    .where(
      and(
        eq(courses.isPublished, true),
        eq(courses.isArchived, false),
        ne(courses.id, excludeCourseId),
        gt(courses.price, 0),
        isNull(enrollments.id),
      ),
    )
    .orderBy(desc(courses.flagship), asc(courses.orderIndex))
    .limit(1);

  return next ?? null;
}

export async function getLessonForStudent(lessonId: number, userId: string, staff = false) {
  const db = await getDb();

  const [row] = await db
    .select({
      lesson: lessons,
      courseId: modules.courseId,
      moduleTitle: modules.title,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!row) return null;

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, row.courseId))
    .limit(1);
  if (!course) return null;

  const access = await accessFor(db, userId, course, staff);
  // Same gate as the course page — closes /lesson/[id], the video stream,
  // saveProgress and completeLesson for unreleased content in one place.
  if (hiddenFromStudent(course, access)) return null;

  const ordered = await orderedLessons(db, course.id);
  const index = ordered.findIndex((l) => l.id === lessonId);
  const [progress] = await db
    .select({ watchedPct: lessonProgress.watchedPct, completed: lessonProgress.completed, lastPositionSec: lessonProgress.lastPositionSec })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  const owns = hasCourseAccess(access);
  const canView = owns;

  return {
    lesson: row.lesson,
    moduleTitle: row.moduleTitle,
    course,
    access,
    owns,
    canView,
    completed: progress?.completed ?? false,
    watchedPct: progress?.watchedPct ?? 0,
    lastPositionSec: progress?.lastPositionSec ?? 0,
    curriculum: ordered,
    position: index + 1,
    total: ordered.length,
    prevLessonId: index > 0 ? ordered[index - 1].id : null,
    nextLessonId: index < ordered.length - 1 ? ordered[index + 1].id : null,
  };
}
