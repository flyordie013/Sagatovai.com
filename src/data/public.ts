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
}

export interface PublicCourseDetail extends PublicCourse {
  modules: {
    id: number;
    title: string;
    lessons: { id: number; title: string }[];
  }[];
}

const publishedOnly = and(eq(courses.isPublished, true), eq(courses.isArchived, false));

async function lessonCounts(): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db
    .select({
      courseId: modules.courseId,
      n: sql<number>`count(${lessons.id})::int`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  return new Map(rows.map((r) => [r.courseId, r.n]));
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
    lessonCount: counts.get(r.id) ?? 0,
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
  const rows = await db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
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
      });
    }
  }
  const moduleList = [...byModule.values()];
  const allLessons = moduleList.flatMap((m) => m.lessons);

  return {
    ...course,
    icon: course.icon as CourseIcon,
    lessonCount: allLessons.length,
    modules: moduleList,
  };
}
