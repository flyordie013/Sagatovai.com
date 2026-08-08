import "server-only";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  mentorThreads,
  mentorMessages,
  profiles,
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
} from "@/db/schema";
import { levelForXp, rankForLevel } from "@/lib/leveling";
import { effectiveStreak } from "@/lib/streak";
import { courseVisibleToStudent } from "./course";
import type { MentorLearningContext } from "@/lib/mentor-ai";

export interface MentorMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}
export interface MentorThreadSummary {
  id: string;
  title: string;
}
export interface MentorData {
  threads: MentorThreadSummary[];
  activeThreadId: string | null;
  messages: MentorMessage[];
}

/**
 * @param threadParam - "new" forces an empty new chat; a valid owned id opens it;
 *   absent opens the most recent thread.
 */
export async function getMentorData(
  userId: string,
  threadParam?: string,
): Promise<MentorData> {
  const db = await getDb();

  const threads = await db
    .select({ id: mentorThreads.id, title: mentorThreads.title })
    .from(mentorThreads)
    .where(eq(mentorThreads.userId, userId))
    .orderBy(desc(mentorThreads.updatedAt));

  let active: string | null = null;
  if (threadParam === "new") active = null;
  else if (threadParam && threads.some((t) => t.id === threadParam)) active = threadParam;
  else if (!threadParam && threads.length > 0) active = threads[0].id;

  let messages: MentorMessage[] = [];
  if (active) {
    const rows = await db
      .select({
        id: mentorMessages.id,
        role: mentorMessages.role,
        content: mentorMessages.content,
      })
      .from(mentorMessages)
      .where(eq(mentorMessages.threadId, active))
      .orderBy(asc(mentorMessages.id));
    messages = rows.map((r) => ({
      id: r.id,
      role: r.role === "assistant" ? "assistant" : "user",
      content: r.content,
    }));
  }

  return { threads, activeThreadId: active, messages };
}

/**
 * Prompt budget for the lesson material. The mentor's whole point is discussing
 * the actual topic, not the title — but the material is sent on EVERY message,
 * so it stays capped: enough to reason about one lesson, small enough to keep
 * each call cheap and fast on a mobile connection.
 */
const LESSON_CONTENT_LIMIT = 1500;
/** How much of the short lesson description is kept (it only frames the topic). */
const LESSON_DESC_LIMIT = 200;

/**
 * Compacts the owner-typed lesson material into a prompt-sized excerpt: blank
 * lines and indentation carry no meaning for the model, and the tail is cut on
 * a word boundary so the mentor never sees half a term.
 */
function lessonExcerpt(content: string): string {
  const text = content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= LESSON_CONTENT_LIMIT) return text;
  const cut = text.slice(0, LESSON_CONTENT_LIMIT);
  const boundary = Math.max(cut.lastIndexOf("\n"), cut.lastIndexOf(" "));
  return `${(boundary > LESSON_CONTENT_LIMIT / 2 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

/**
 * Builds the student's current learning snapshot for the AI mentor prompt.
 * Every query is scoped by `userId` (the caller passes the session user), so it
 * can only ever read the caller's own progress/enrollments. The public course
 * catalog (titles/descriptions) is shared content, not another user's data.
 */
export async function getMentorLearningContext(
  userId: string,
): Promise<MentorLearningContext> {
  const db = await getDb();

  const [p] = await db
    .select({
      xp: profiles.xp,
      streak: profiles.currentStreak,
      lastActivityAt: profiles.lastActivityAt,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  const level = p ? levelForXp(p.xp) : 1;
  const ctx: MentorLearningContext = {
    rank: rankForLevel(level),
    level,
    // A broken streak reads as 0 — the mentor must not congratulate a student
    // on "30 дней подряд" they lost a month ago.
    currentStreak: p ? effectiveStreak(p.streak, p.lastActivityAt) : 0,
    activeCourse: null,
    currentLesson: null,
    nextLesson: null,
    otherCourses: [],
  };
  if (!p) return ctx;

  // Courses the user is enrolled in and still allowed to see (scoped by userId):
  // released ones, plus drafts/archived courses their enrollment keeps open.
  const enrolled = await db
    .select({
      id: courses.id,
      title: courses.title,
      access: enrollments.accessType,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, userId), courseVisibleToStudent()))
    .orderBy(asc(courses.orderIndex));
  const accessible = enrolled.filter((c) => c.access !== "locked");

  // Most recently touched lesson (scoped by userId). Accessibility is filtered
  // in SQL *before* the limit, so progress in a locked course can never crowd
  // out the real active lesson. A live enrollment is the whole test here — it
  // already covers drafts and archived courses, exactly like the list above.
  // `id` breaks ties deterministically (rows written in one batch share a
  // timestamp).
  const [active = null] = await db
    .select({
      lessonId: lessonProgress.lessonId,
      watchedPct: lessonProgress.watchedPct,
      completed: lessonProgress.completed,
      lessonTitle: lessons.title,
      lessonDesc: lessons.description,
      lessonContent: lessons.content,
      moduleTitle: modules.title,
      courseId: modules.courseId,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .innerJoin(
      enrollments,
      and(eq(enrollments.courseId, courses.id), eq(enrollments.userId, userId)),
    )
    .where(
      and(eq(lessonProgress.userId, userId), ne(enrollments.accessType, "locked")),
    )
    .orderBy(desc(lessonProgress.updatedAt), desc(lessonProgress.id))
    .limit(1);

  const activeCourseId = active?.courseId ?? accessible[0]?.id ?? null;
  const activeCourse = enrolled.find((c) => c.id === activeCourseId);
  if (!activeCourse) return ctx; // no accessible course → newbie block

  // Ordered lessons of the active course → position / total / next lesson.
  const ordered = await db
    .select({ id: lessons.id, title: lessons.title, moduleTitle: modules.title })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, activeCourse.id))
    .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex));
  const total = ordered.length;

  // Completed lessons for this user in this course (scoped by userId).
  const doneRows = await db
    .select({ lessonId: lessonProgress.lessonId })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.completed, true),
        eq(modules.courseId, activeCourse.id),
      ),
    );
  const doneSet = new Set(doneRows.map((r) => r.lessonId));
  const completed = doneSet.size;

  ctx.activeCourse = {
    title: activeCourse.title,
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };

  if (active) {
    const pos = ordered.findIndex((l) => l.id === active.lessonId);
    // The lesson MATERIAL, not just its title — otherwise the mentor answers in
    // generalities about a topic it can't actually see. Both parts go into the
    // one free-form field the prompt renders (`description`); when there is no
    // short description, the material stands on its own.
    const desc = (active.lessonDesc ?? "").slice(0, LESSON_DESC_LIMIT).trim();
    const material = lessonExcerpt(active.lessonContent ?? "");
    const about =
      desc && material
        ? `${desc}\n\nМатериалы урока (фрагмент):\n${material}`
        : desc || material;
    ctx.currentLesson = {
      moduleTitle: active.moduleTitle,
      title: active.lessonTitle,
      description: about,
      position: pos >= 0 ? pos + 1 : 1,
      total,
      completed: active.completed,
      watchedPct: active.watchedPct,
    };
  }

  // First unfinished lesson. Under sequential unlock that is usually the lesson
  // they're on right now, so skip past it — "Следующий урок" must not name the
  // same lesson as "Сейчас изучает".
  const nextIdx = ordered.findIndex((l) => !doneSet.has(l.id));
  let next = nextIdx >= 0 ? ordered[nextIdx] : undefined;
  if (next && active && next.id === active.lessonId) next = ordered[nextIdx + 1];
  if (next) ctx.nextLesson = { title: next.title, moduleTitle: next.moduleTitle };

  ctx.otherCourses = accessible
    .filter((c) => c.id !== activeCourse.id)
    .map((c) => c.title)
    .slice(0, 5);

  return ctx;
}
