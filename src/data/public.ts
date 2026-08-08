import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, modules, lessons } from "@/db/schema";
import type { CourseIcon } from "@/types";

/**
 * Storefront data. Everything here is readable by anonymous visitors, so it
 * must expose ONLY marketing-safe fields: never lesson content, video URLs, or
 * anything tied to a specific user. Archived / unpublished courses are hidden.
 */

export interface PublicCourse {
  id: number;
  slug: string;
  title: string;
  description: string;
  icon: CourseIcon;
  weeks: number;
  rating: number;
  flagship: boolean;
  price: number;
  lessonCount: number;
  /**
   * How many lessons are marked as a free preview. Marketing-safe: it says
   * that a taste of the course exists, never who may watch it — the actual
   * access check lives in src/data/course.ts and stays untouched.
   */
  freeLessonCount: number;
}

export interface PublicCourseDetail extends PublicCourse {
  modules: {
    id: number;
    title: string;
    lessons: { id: number; title: string; isFree: boolean }[];
  }[];
}

const publishedOnly = and(eq(courses.isPublished, true), eq(courses.isArchived, false));

interface LessonTally {
  total: number;
  free: number;
}

async function lessonCounts(): Promise<Map<number, LessonTally>> {
  const db = await getDb();
  const rows = await db
    .select({
      courseId: modules.courseId,
      n: sql<number>`count(${lessons.id})::int`,
      free: sql<number>`count(${lessons.id}) filter (where ${lessons.isFree})::int`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  return new Map(rows.map((r) => [r.courseId, { total: r.n, free: r.free }]));
}

export async function listPublicCourses(): Promise<PublicCourse[]> {
  const db = await getDb();
  const rows = await db
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
    })
    .from(courses)
    .where(publishedOnly)
    .orderBy(asc(courses.orderIndex));

  const counts = await lessonCounts();
  return rows.map((r) => ({
    ...r,
    icon: r.icon as CourseIcon,
    lessonCount: counts.get(r.id)?.total ?? 0,
    freeLessonCount: counts.get(r.id)?.free ?? 0,
  }));
}

export async function getPublicCourse(slug: string): Promise<PublicCourseDetail | null> {
  const db = await getDb();
  const [course] = await db
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
    })
    .from(courses)
    .where(and(publishedOnly, eq(courses.slug, slug)))
    .limit(1);
  if (!course) return null;

  // Curriculum outline only — titles sell the course; content stays private.
  // `isFree` is a label, not a key: it tells a cold visitor a preview exists.
  const rows = await db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      lessonIsFree: lessons.isFree,
    })
    .from(modules)
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, course.id))
    .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex));

  const byModule = new Map<number, PublicCourseDetail["modules"][number]>();
  for (const r of rows) {
    let m = byModule.get(r.moduleId);
    if (!m) {
      m = { id: r.moduleId, title: r.moduleTitle, lessons: [] };
      byModule.set(r.moduleId, m);
    }
    if (r.lessonId != null) {
      m.lessons.push({
        id: r.lessonId,
        title: r.lessonTitle ?? "",
        isFree: r.lessonIsFree ?? false,
      });
    }
  }
  const moduleList = [...byModule.values()];
  const allLessons = moduleList.flatMap((m) => m.lessons);

  return {
    ...course,
    icon: course.icon as CourseIcon,
    lessonCount: allLessons.length,
    freeLessonCount: allLessons.filter((l) => l.isFree).length,
    modules: moduleList,
  };
}
