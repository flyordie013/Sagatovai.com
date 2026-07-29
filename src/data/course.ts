import "server-only";
import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
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

/**
 * Effective course access. An explicit enrollment always wins; otherwise a
 * free course is open to any signed-in user (registration auto-enrolls, but
 * courses created later — or seeded users — must not be shut out).
 */
async function accessFor(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  course: { id: number; price: number; isPublished: boolean; isArchived: boolean },
): Promise<CourseAccess> {
  const [e] = await db
    .select({ a: enrollments.accessType })
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, course.id)))
    .limit(1);
  // An explicit enrollment always wins — a student who paid keeps access even
  // if the owner later unpublishes the course to edit it.
  if (e) return e.a;
  // Not enrolled: only a PUBLISHED free course is open. Without the published
  // check, a draft course (price defaults to 0 in the create form) would be
  // readable by any signed-in user before release.
  return course.price === 0 && course.isPublished && !course.isArchived ? "full" : "none";
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
    ne(enrollments.accessType, "locked"),
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
      isFree: lessons.isFree,
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
  /** Sequential gate: free preview, first lesson, or the previous one is done. */
  unlocked: boolean;
  /** Marked as a free preview by the owner. */
  isFree: boolean;
  /** Sequential gate passed AND the student is allowed to watch it at all. */
  playable: boolean;
}

/** Owning the course (paid or trial) opens every lesson. */
export function hasCourseAccess(access: CourseAccess): boolean {
  return access === "full" || access === "trial";
}

export async function getCourseForStudent(slug: string, userId: string) {
  const db = await getDb();

  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  if (!course) return null;

  const access = await accessFor(db, userId, course);
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

  // Sequential unlock: a lesson is unlocked if it's first or the previous is done.
  // A free preview always opens, whatever its position — the gate would
  // otherwise bury every preview that isn't lesson №1 behind lessons the
  // student can't even watch.
  const unlocked = new Set<number>();
  for (let i = 0; i < ordered.length; i++) {
    if (i === 0 || ordered[i].isFree || done.has(ordered[i - 1].id)) {
      unlocked.add(ordered[i].id);
    }
  }

  const owns = hasCourseAccess(access);

  const byModule = new Map<number, StudentLesson[]>();
  for (const l of ordered) {
    const list = byModule.get(l.moduleId) ?? [];
    list.push({
      id: l.id,
      title: l.title,
      duration: l.duration,
      completed: done.has(l.id),
      unlocked: unlocked.has(l.id),
      isFree: l.isFree,
      playable: (owns || l.isFree) && unlocked.has(l.id),
    });
    byModule.set(l.moduleId, list);
  }

  // "Continue" should never point at a lesson the student can't open.
  const nextLesson = ordered.find((l) => !done.has(l.id) && (owns || l.isFree));
  const freeLessons = ordered.filter((l) => l.isFree).length;

  return {
    course,
    access,
    owns,
    freeLessons,
    requested: Boolean(openRequest),
    totalLessons: ordered.length,
    completedLessons: done.size,
    // The whole course is finished (only meaningful for an owner).
    courseCompleted: owns && ordered.length > 0 && done.size >= ordered.length,
    nextLessonId: nextLesson?.id ?? null,
    modules: mods.map((m) => ({ id: m.id, title: m.title, lessons: byModule.get(m.id) ?? [] })),
  };
}

export async function getLessonForStudent(lessonId: number, userId: string) {
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

  const access = await accessFor(db, userId, course);
  // Same gate as the course page — closes /lesson/[id], the video stream,
  // saveProgress and completeLesson for unreleased content in one place.
  if (hiddenFromStudent(course, access)) return null;

  const ordered = await orderedLessons(db, course.id);
  const done = await completedIds(db, userId, ordered.map((l) => l.id));
  const index = ordered.findIndex((l) => l.id === lessonId);
  // Same gate as the course page (free previews ignore the sequence). This also
  // opens /api/lessons/[id]/video, which reuses `unlocked` + `canView`.
  const unlocked =
    index === 0 || row.lesson.isFree || (index > 0 && done.has(ordered[index - 1].id));

  const [progress] = await db
    .select({ watchedPct: lessonProgress.watchedPct, completed: lessonProgress.completed })
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)))
    .limit(1);

  // Free preview lessons are watchable without owning the course; everything
  // else needs an enrollment. The sequential gate applies on top of both.
  const owns = hasCourseAccess(access);
  const canView = owns || row.lesson.isFree;

  return {
    lesson: row.lesson,
    moduleTitle: row.moduleTitle,
    course,
    access,
    owns,
    canView,
    unlocked,
    completed: progress?.completed ?? false,
    watchedPct: progress?.watchedPct ?? 0,
    position: index + 1,
    total: ordered.length,
    prevLessonId: index > 0 ? ordered[index - 1].id : null,
    nextLessonId: index < ordered.length - 1 ? ordered[index + 1].id : null,
  };
}
