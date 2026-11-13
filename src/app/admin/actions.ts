"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  lessonMaterials,
  payments,
  profiles,
  missions,
  userMissions,
  achievements,
  userAchievements,
  storeItems,
  redemptions,
  leads,
} from "@/db/schema";
import { requireStaff } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { provisionNewStudent } from "@/lib/provision";
import { removeMaterial } from "@/lib/material-storage";
import { deleteVideo } from "@/lib/storage";
import { levelForXp, rankForLevel } from "@/lib/leveling";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { MIN_PASSWORD } from "@/lib/auth-rules";

/** Removes uploaded video files for a set of storage keys (best-effort). */
async function purgeVideos(keys: (string | null)[]): Promise<void> {
  await Promise.all(keys.filter((k): k is string => Boolean(k)).map((k) => deleteVideo(k)));
}

type PaymentMethod = "manual" | "kaspi" | "card";
const PAYMENT_METHODS: readonly PaymentMethod[] = ["manual", "kaspi", "card"];

type Icon = "sparkles" | "bot" | "code";

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}
function int(fd: FormData, key: string, fallback = 0): number {
  const v = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(v) ? v : fallback;
}
function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v != null && v !== "false" && v !== "0";
}
/**
 * Course rating, 0–5 with one decimal. An empty field means "no rating yet" → 0,
 * which is exactly what the storefront hides the stars on. Out-of-range input is
 * clamped instead of rejected, so a typo can never publish a 50-star course.
 */
function rating(fd: FormData, key: string): number {
  const raw = str(fd, key).replace(",", ".");
  if (!raw) return 0;
  const v = Number.parseFloat(raw);
  if (!Number.isFinite(v)) return 0;
  return Math.min(5, Math.max(0, Math.round(v * 10) / 10));
}

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `course-${Date.now().toString(36)}`;
}

async function nextOrderIndex(
  table: typeof modules | typeof lessons,
  fkColumn: typeof modules.courseId | typeof lessons.moduleId,
  fkValue: number,
): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ v: sql<number>`coalesce(max(${table.orderIndex}), -1)::int` })
    .from(table)
    .where(eq(fkColumn, fkValue));
  return (row?.v ?? -1) + 1;
}

/** Same idea for courses — they have no parent, so the whole table is the list. */
async function nextCourseOrderIndex(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ v: sql<number>`coalesce(max(${courses.orderIndex}), -1)::int` })
    .from(courses);
  return (row?.v ?? -1) + 1;
}

/** Lessons in a course, across all its modules. */
async function countLessons(courseId: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId));
  return row?.n ?? 0;
}

function revalidateCourse(courseId: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/dashboard"); // student catalog reflects new content
}

/* ------------------------------ courses ------------------------------ */

export async function createCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const title = str(formData, "title");
  if (!title) return;

  let slug = str(formData, "slug") || slugify(title);
  const clash = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  if (clash.length) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const [row] = await db
    .insert(courses)
    .values({
      slug,
      title,
      description: str(formData, "description"),
      audience: str(formData, "audience").slice(0, 5000),
      outcomes: str(formData, "outcomes").slice(0, 5000),
      requirements: str(formData, "requirements").slice(0, 5000),
      included: str(formData, "included").slice(0, 5000),
      accessTerms: str(formData, "accessTerms").slice(0, 5000),
      authorName: str(formData, "authorName").slice(0, 150),
      authorBio: str(formData, "authorBio").slice(0, 5000),
      icon: ((str(formData, "icon") || "sparkles") as Icon),
      weeks: int(formData, "weeks"),
      price: int(formData, "price"),
      flagship: bool(formData, "flagship"),
      // A brand-new course is always a draft until its structure is ready.
      isPublished: false,
      orderIndex: await nextCourseOrderIndex(),
    })
    .returning({ id: courses.id });

  revalidateCourse(row.id);
  redirect(`/admin/courses/${row.id}`);
}

export async function updateCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  const title = str(formData, "title");
  if (!id || !title) return; // never wipe the title with a blank submit

  // An archived course can't be published straight from settings — it would land
  // in a published+archived limbo (hidden from students but counted as
  // published). It must be restored first.
  const [existing] = await db
    .select({ isArchived: courses.isArchived })
    .from(courses)
    .where(eq(courses.id, id))
    .limit(1);
  const wantsPublish = existing?.isArchived ? false : bool(formData, "isPublished");
  // Same rule as togglePublish — an empty course must not reach the storefront,
  // whichever control the owner used to publish it.
  const empty = wantsPublish && (await countLessons(id)) === 0;
  const isPublished = wantsPublish && !empty;

  // Optional slug edit — slugified, kept unique (excluding this course), and
  // only applied when non-empty so a blank field never wipes the URL.
  const rawSlug = str(formData, "slug");
  let slug: string | undefined;
  if (rawSlug) {
    slug = slugify(rawSlug);
    const [clash] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, slug), ne(courses.id, id)))
      .limit(1);
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  await db
    .update(courses)
    .set({
      title,
      ...(slug ? { slug } : {}),
      description: str(formData, "description"),
      audience: str(formData, "audience").slice(0, 5000), outcomes: str(formData, "outcomes").slice(0, 5000),
      requirements: str(formData, "requirements").slice(0, 5000), included: str(formData, "included").slice(0, 5000),
      accessTerms: str(formData, "accessTerms").slice(0, 5000), authorName: str(formData, "authorName").slice(0, 150), authorBio: str(formData, "authorBio").slice(0, 5000),
      icon: ((str(formData, "icon") || "sparkles") as Icon),
      weeks: int(formData, "weeks"),
      price: int(formData, "price"),
      rating: rating(formData, "rating"),
      flagship: bool(formData, "flagship"),
      isPublished,
    })
    .where(eq(courses.id, id));

  revalidateCourse(id);
  if (empty) redirect(`/admin/courses/${id}?error=no-lessons`);
}

export async function togglePublish(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  if (!id) return;
  const next = bool(formData, "next");

  // Publishing a course without a single lesson puts an empty card on the
  // storefront; if it's also free, every new student gets a permanent
  // enrollment to nothing. Refuse and say why instead of silently doing it.
  if (next && (await countLessons(id)) === 0) {
    redirect(`/admin/courses/${id}?error=no-lessons`);
  }

  await db.update(courses).set({ isPublished: next }).where(eq(courses.id, id));
  revalidateCourse(id);
}

/** Moves a course up/down in the storefront order (position-reindex). */
export async function moveCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  const dir = str(formData, "dir");
  if (!id || (dir !== "up" && dir !== "down")) return;

  const sibs = await db
    .select({ id: courses.id })
    .from(courses)
    .orderBy(asc(courses.orderIndex), asc(courses.id));
  const idx = sibs.findIndex((c) => c.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swap < 0 || swap >= sibs.length) return;

  const order = sibs.map((c) => c.id);
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      await tx.update(courses).set({ orderIndex: i }).where(eq(courses.id, order[i]));
    }
  });
  revalidateCourse(id);
}

export async function deleteCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  if (!id) return;

  const removed = await db.transaction(async (tx) => {
    await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, id)).for("update");
    const [{ n: paid }] = await tx.select({ n: sql<number>`count(*)::int` }).from(payments)
      .where(and(eq(payments.courseId, id), eq(payments.status, "paid")));
    if (paid > 0) {
      await tx.update(courses).set({ isArchived: true, isPublished: false }).where(eq(courses.id, id));
      return null;
    }
    await tx.select({ id: modules.id }).from(modules).where(eq(modules.courseId, id)).orderBy(asc(modules.id)).for("update");
    const keys = await tx.select({ videoKey: lessons.videoKey }).from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id)).where(eq(modules.courseId, id)).orderBy(asc(lessons.id)).for("update", { of: lessons });
    const attachments = await tx.select({ key: lessonMaterials.storageKey }).from(lessonMaterials)
      .innerJoin(lessons, eq(lessonMaterials.lessonId, lessons.id)).innerJoin(modules, eq(lessons.moduleId, modules.id)).where(eq(modules.courseId, id));
    await tx.delete(courses).where(eq(courses.id, id));
    return { keys, attachments };
  });
  if (removed) {
    await Promise.all(removed.attachments.map(f => removeMaterial(f.key)));
    await purgeVideos(removed.keys.map(k => k.videoKey));
  }

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/dashboard");
  redirect("/admin/courses");
}

/** Un-archives a course (back to draft — the owner re-publishes when ready). */
export async function restoreCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  if (!id) return;
  await db.update(courses).set({ isArchived: false }).where(eq(courses.id, id));
  revalidateCourse(id);
}

/* ------------------------------ modules ------------------------------ */

export async function createModule(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const courseId = int(formData, "courseId");
  const title = str(formData, "title");
  if (!courseId || !title) return;

  const orderIndex = await nextOrderIndex(modules, modules.courseId, courseId);
  await db.insert(modules).values({ courseId, title, orderIndex });
  revalidateCourse(courseId);
}

export async function updateModule(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "moduleId");
  const courseId = int(formData, "courseId");
  const title = str(formData, "title");
  if (!id || !title) return; // never wipe the title with a blank submit
  await db.update(modules).set({ title }).where(eq(modules.id, id));
  revalidateCourse(courseId);
}

/** Moves a module up/down among its course siblings (position-reindex). */
export async function moveModule(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "moduleId");
  const courseId = int(formData, "courseId");
  const dir = str(formData, "dir");
  if (!id || !courseId || (dir !== "up" && dir !== "down")) return;

  const sibs = await db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(asc(modules.orderIndex), asc(modules.id));
  const idx = sibs.findIndex((m) => m.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swap < 0 || swap >= sibs.length) return;

  const order = sibs.map((m) => m.id);
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      await tx.update(modules).set({ orderIndex: i }).where(eq(modules.id, order[i]));
    }
  });
  revalidateCourse(courseId);
}

export async function deleteModule(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "moduleId");
  const courseId = int(formData, "courseId");
  if (!id) return;
  const removed = await db.transaction(async (tx) => {
    await tx.select({ id: modules.id }).from(modules).where(eq(modules.id, id)).for("update");
    const keys = await tx.select({ videoKey: lessons.videoKey }).from(lessons).where(eq(lessons.moduleId, id)).orderBy(asc(lessons.id)).for("update");
    const attachments = await tx.select({ key: lessonMaterials.storageKey }).from(lessonMaterials)
      .innerJoin(lessons, eq(lessonMaterials.lessonId, lessons.id)).where(eq(lessons.moduleId, id));
    await tx.delete(modules).where(eq(modules.id, id));
    return { keys, attachments };
  });
  await Promise.all(removed.attachments.map(f => removeMaterial(f.key)));
  await purgeVideos(removed.keys.map(k => k.videoKey));
  revalidateCourse(courseId);
}

/* ------------------------------ lessons ------------------------------ */

/**
 * The lesson player is a plain `<video>` tag: it plays a media FILE, not a watch
 * page. A YouTube/Vimeo/Google Drive link saves fine and then shows the student
 * a black rectangle, so such links are refused here — the owner uploads the file
 * instead. Signed CDN links keep working: the query string is stripped before
 * the extension is checked.
 */
// `.m3u8` is here because Safari — i.e. most of the audience — plays HLS
// natively in a plain <video>, which is exactly what the lesson page renders.
const DIRECT_VIDEO_FILE = /\.(mp4|webm|ogv|ogg|mov|m4v|m3u8)$/i;

function isPlayableVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && DIRECT_VIDEO_FILE.test(parsed.pathname);
  } catch { return false; }
}

export async function createLesson(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const moduleId = int(formData, "moduleId");
  const courseId = int(formData, "courseId");
  const title = str(formData, "title");
  if (!moduleId || !title) return;

  const orderIndex = await nextOrderIndex(lessons, lessons.moduleId, moduleId);
  await db.insert(lessons).values({ moduleId, title, orderIndex });
  revalidateCourse(courseId);
}

export async function updateLesson(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "lessonId");
  const courseId = int(formData, "courseId");
  const title = str(formData, "title");
  if (!id || !title) return; // never wipe the title with a blank submit

  // A link the player can't play is dropped, not stored — the rest of the edit
  // still saves and the redirect below explains what happened.
  const videoUrl = str(formData, "videoUrl") || null;
  const badVideoUrl = videoUrl !== null && !isPlayableVideoUrl(videoUrl);

  await db
    .update(lessons)
    .set({
      title,
      description: str(formData, "description"),
      content: str(formData, "content"),
      ...(badVideoUrl ? {} : { videoUrl }),
      videoDurationSec: int(formData, "videoDurationSec"),
    })
    .where(eq(lessons.id, id));

  revalidateCourse(courseId);
  if (badVideoUrl) redirect(`/admin/courses/${courseId}?error=video-url`);
}

/** Moves a lesson up/down within its module (position-reindex). */
export async function moveLesson(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "lessonId");
  const moduleId = int(formData, "moduleId");
  const courseId = int(formData, "courseId");
  const dir = str(formData, "dir");
  if (!id || !moduleId || (dir !== "up" && dir !== "down")) return;

  const sibs = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(asc(lessons.orderIndex), asc(lessons.id));
  const idx = sibs.findIndex((l) => l.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swap < 0 || swap >= sibs.length) return;

  const order = sibs.map((l) => l.id);
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await db.transaction(async (tx) => {
    for (let i = 0; i < order.length; i++) {
      await tx.update(lessons).set({ orderIndex: i }).where(eq(lessons.id, order[i]));
    }
  });
  revalidateCourse(courseId);
}

export async function deleteLesson(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "lessonId");
  const courseId = int(formData, "courseId");
  if (!id) return;
  const removed = await db.transaction(async (tx) => {
    const keys = await tx.select({ videoKey: lessons.videoKey }).from(lessons).where(eq(lessons.id, id)).orderBy(asc(lessons.id)).for("update");
    const attachments = await tx.select({ key: lessonMaterials.storageKey }).from(lessonMaterials)
      .innerJoin(lessons, eq(lessonMaterials.lessonId, lessons.id)).where(eq(lessons.id, id));
    await tx.delete(lessons).where(eq(lessons.id, id));
    return { keys, attachments };
  });
  await Promise.all(removed.attachments.map(f => removeMaterial(f.key)));
  await purgeVideos(removed.keys.map(k => k.videoKey));
  revalidateCourse(courseId);
}

/* ------------------------------- leads ------------------------------- */

type LeadStatus = "new" | "contacted" | "won" | "lost";
const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "won", "lost"];

/** Triage a storefront lead so the sales inbox doesn't become one flat pile. */
export async function setLeadStatus(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "leadId");
  const next = str(formData, "next") as LeadStatus;
  if (!id || !LEAD_STATUSES.includes(next)) return;

  await db.update(leads).set({ status: next }).where(eq(leads.id, id));
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

/**
 * Removes a lead for good. The form is public, so spam lands in the same inbox
 * as real customers — without this the only way to clear it is a SQL client.
 * Irreversible: the UI asks for confirmation first (ConfirmSubmit).
 */
export async function deleteLead(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "leadId");
  if (!id) return;

  await db.delete(leads).where(eq(leads.id, id));
  revalidatePath("/admin/leads");
  revalidatePath("/admin");
}

/* --------------------------- gamification --------------------------- */

function revalidateGamification() {
  revalidatePath("/admin/gamification");
  revalidatePath("/dashboard");
  revalidatePath("/achievements");
  revalidatePath("/store");
}

function slugCode(input: string, prefix: string): string {
  const base =
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || prefix;
  // Always append randomness so a Cyrillic-only name (which strips to nothing)
  // can never collide with another → creation never silently no-ops.
  return `${base}_${randomBytes(3).toString("hex")}`;
}

/**
 * Creates a mission and immediately assigns it to every student — otherwise it
 * would exist but never appear for anyone, since `user_missions` rows are only
 * created at provisioning time.
 */
export async function createMission(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const title = str(formData, "title");
  if (!title) return;

  const [m] = await db
    .insert(missions)
    .values({
      title,
      description: str(formData, "description"),
      target: Math.max(1, int(formData, "target", 1)),
      xpReward: Math.max(0, int(formData, "xpReward")),
      isActive: true,
    })
    .returning({ id: missions.id });

  const students = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.role, "student"));
  if (students.length > 0) {
    await db
      .insert(userMissions)
      .values(students.map((s) => ({ userId: s.id, missionId: m.id })))
      .onConflictDoNothing();
  }

  revalidateGamification();
}

export async function toggleMission(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = str(formData, "missionId");
  if (!id) return;
  await db
    .update(missions)
    .set({ isActive: bool(formData, "next") })
    .where(eq(missions.id, id));
  revalidateGamification();
}

export async function deleteMission(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = str(formData, "missionId");
  if (!id) return;
  await db.delete(missions).where(eq(missions.id, id)); // cascades user_missions
  revalidateGamification();
}

/**
 * Unlocks an achievement for everyone who ALREADY passed its target.
 *
 * `completeLesson` only evaluates achievements when a lesson is finished, so an
 * achievement added (or lowered) after students have progressed would stay
 * locked until their next lesson — and for someone who finished the course, for
 * ever. XP/level/rank are granted here exactly like the runtime path does.
 */
async function backfillAchievement(
  achievementId: string,
  target: number,
  xpReward: number,
): Promise<void> {
  const db = await getDb();
  const now = new Date();

  const qualified = await db
    .select({ userId: lessonProgress.userId })
    .from(lessonProgress)
    .where(eq(lessonProgress.completed, true))
    .groupBy(lessonProgress.userId)
    .having(sql`count(*) >= ${target}`);

  for (const { userId } of qualified) {
    await db.transaction(async (tx) => {
      const [p] = await tx.select({ xp: profiles.xp }).from(profiles).where(eq(profiles.id, userId)).for("update");
      if (!p) return;
      const ins = await tx.insert(userAchievements).values({ userId, achievementId, progress: target, unlockedAt: now })
        .onConflictDoUpdate({
          target: [userAchievements.userId, userAchievements.achievementId],
          set: { progress: target, unlockedAt: now }, setWhere: isNull(userAchievements.unlockedAt),
        }).returning({ id: userAchievements.id });
      if (!ins.length || xpReward <= 0) return;
      const newXp = p.xp + xpReward;
      const level = levelForXp(newXp);
      await tx.update(profiles).set({ xp: newXp, level, rank: rankForLevel(level) }).where(eq(profiles.id, userId));
    });
  }
}

export async function createAchievement(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const title = str(formData, "title");
  if (!title) return;
  const code = slugCode(str(formData, "code") || title, "ach");
  const target = Math.max(1, int(formData, "target", 1));
  const xpReward = Math.max(0, int(formData, "xpReward"));

  const [created] = await db
    .insert(achievements)
    .values({
      code,
      title,
      description: str(formData, "description"),
      target,
      xpReward,
    })
    .onConflictDoNothing({ target: achievements.code })
    .returning({ id: achievements.id });

  if (created) await backfillAchievement(created.id, target, xpReward);

  revalidateGamification();
}

/** Edits an achievement and re-runs the backfill (a lowered target opens it). */
export async function updateAchievement(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = str(formData, "achievementId");
  const title = str(formData, "title");
  if (!id || !title) return; // never wipe the title with a blank submit

  const target = Math.max(1, int(formData, "target", 1));
  const xpReward = Math.max(0, int(formData, "xpReward"));
  await db
    .update(achievements)
    .set({ title, description: str(formData, "description"), target, xpReward })
    .where(eq(achievements.id, id));

  await backfillAchievement(id, target, xpReward);

  revalidateGamification();
}

export async function deleteAchievement(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = str(formData, "achievementId");
  if (!id) return;
  await db.delete(achievements).where(eq(achievements.id, id));
  revalidateGamification();
}

export async function createStoreItem(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const name = str(formData, "name");
  if (!name) return;
  const code = slugCode(str(formData, "code") || name, "item");
  const category = str(formData, "category") || "merch";

  await db
    .insert(storeItems)
    .values({
      code,
      name,
      description: str(formData, "description"),
      category: ["merch", "guide", "video"].includes(category) ? category : "merch",
      xpRequired: Math.max(0, int(formData, "xpRequired")),
      payloadUrl: str(formData, "payloadUrl") || null,
      isActive: true,
    })
    .onConflictDoNothing({ target: storeItems.code });

  revalidateGamification();
}

export async function deleteStoreItem(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "itemId");
  if (!id) return;
  await db.delete(storeItems).where(eq(storeItems.id, id));
  revalidateGamification();
}

/** Marks a claimed reward as handed over (or cancels it). */
export async function setRedemptionStatus(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "redemptionId");
  const next = str(formData, "next");
  if (!id || !["pending", "fulfilled", "cancelled"].includes(next)) return;

  await db
    .update(redemptions)
    .set({ status: next as "pending" | "fulfilled" | "cancelled" })
    .where(eq(redemptions.id, id));

  revalidatePath("/admin/gamification");
}

/* ------------------------------- users ------------------------------- */

type Role = "student" | "curator" | "admin" | "superadmin";
/**
 * Roles the admin UI may assign. "curator" exists in the DB enum but has no
 * screens of its own (it is not staff, so /admin redirects it away) — handing it
 * out would create an account that can do nothing, so it is not offered.
 * "superadmin" is accepted here but additionally gated on the caller's own role.
 */
const ASSIGNABLE_ROLES: readonly Role[] = ["student", "admin", "superadmin"];

/** Superadmins left on the platform — the last one may never be removed. */
async function countSuperadmins(): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.role, "superadmin"));
  return row?.n ?? 0;
}

/**
 * Creates an account on behalf of a customer after payment. The owner sets the
 * initial password and relays it to the student.
 */
export async function createUser(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const db = await getDb();

  const fullName = str(formData, "fullName");
  const email = str(formData, "email").toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  const rawRole = str(formData, "role") as Role;
  let role: Role = ASSIGNABLE_ROLES.includes(rawRole) ? rawRole : "student";
  // Only an owner can mint another owner — otherwise a plain admin could
  // promote themselves past the owner via a hand-crafted request.
  if (role === "superadmin" && session.role !== "superadmin") role = "admin";

  if (!fullName || !email || !email.includes("@")) return;
  if (password.length < MIN_PASSWORD) return;

  const [existing] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  if (existing) redirect(`/admin/users/${existing.id}`);

  const passwordHash = await hashPassword(password);
  let userId: string;
  try {
    const [created] = await db
      .insert(profiles)
      .values({ fullName, email, passwordHash, role })
      .returning({ id: profiles.id });
    userId = created.id;
  } catch {
    return; // unique-email race
  }

  if (role === "student") await provisionNewStudent(db, userId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect(`/admin/users/${userId}`);
}

/**
 * Sets a new password for a user. There is no self-service reset yet, so this
 * is the only way to rescue a locked-out paying customer.
 */
export async function resetUserPassword(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();

  const userId = str(formData, "userId");
  const password = (formData.get("password") ?? "").toString();
  if (!userId || password.length < MIN_PASSWORD) return;

  // Bump sessionVersion too — a forced reset should also drop the user's
  // existing sessions (e.g. a compromised account).
  const passwordHash = await hashPassword(password);
  await db
    .update(profiles)
    .set({ passwordHash, sessionVersion: sql`${profiles.sessionVersion} + 1` })
    .where(eq(profiles.id, userId));

  revalidatePath(`/admin/users/${userId}`);
}

/**
 * Edits an account (name / email / role). The role guards exist so the owner
 * can't lock themselves — or everyone — out of /admin:
 *   - nobody changes their OWN role (a self-demote drops you out mid-request);
 *   - only a superadmin hands out superadmin;
 *   - the last superadmin can't be demoted.
 * A blocked role change keeps the current role rather than failing the whole
 * edit, so the name/email part still saves.
 */
export async function updateUser(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const db = await getDb();

  const userId = str(formData, "userId");
  const fullName = str(formData, "fullName");
  const email = str(formData, "email").toLowerCase();
  if (!userId || !fullName || !email.includes("@")) return;

  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!target) return;

  const rawRole = str(formData, "role") as Role;
  let role: Role = ASSIGNABLE_ROLES.includes(rawRole) ? rawRole : target.role;
  if (userId === session.userId) role = target.role;
  if (role === "superadmin" && session.role !== "superadmin") role = target.role;
  if (target.role === "superadmin" && role !== "superadmin" && (await countSuperadmins()) <= 1)
    role = target.role;

  // Email is the login — a duplicate would throw on the unique index and lose
  // the whole edit, so bail out before writing.
  const [clash] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.email, email), ne(profiles.id, userId)))
    .limit(1);
  if (clash) return;

  await db.update(profiles).set({ fullName, email, role }).where(eq(profiles.id, userId));

  // Someone turned into a student receives active missions, but no course
  // access — courses are granted separately after payment verification.
  if (role === "student" && target.role !== "student") await provisionNewStudent(db, userId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

/**
 * Deletes an account for good — enrollments, progress and payment history
 * cascade with it. Guarded against the two irreversible mistakes: deleting
 * yourself, and deleting the last superadmin (nobody would own the platform).
 */
export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const db = await getDb();

  const userId = str(formData, "userId");
  if (!userId || userId === session.userId) return;

  const [target] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!target) return;
  if (target.role === "superadmin" && (await countSuperadmins()) <= 1) return;

  await db.delete(profiles).where(eq(profiles.id, userId));

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/* --------------------------- access / payments --------------------------- */

/**
 * Base address for links inside outgoing mail. APP_URL is the single source of
 * truth (same rule as the password reset) — in production we'd rather send no
 * letter than one pointing at the wrong host.
 */
function appBaseUrl(): string | null {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

/** Declines an open purchase request without granting access. */
export async function declineRequest(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const paymentId = int(formData, "paymentId");
  if (!paymentId) return;

  // "declined" (not "refunded") — this request was never paid, so calling it a
  // refund would misrepresent it in the user's payment history.
  await db
    .update(payments)
    .set({ status: "declined", updatedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "requested")));

  revalidatePath("/admin");
  revalidatePath("/admin/requests");
}

/**
 * Revokes a student's access to a course and refunds the recorded payment, in
 * one transaction. Revenue self-corrects (stats count only `paid`).
 */
export async function revokeAccess(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const userId = str(formData, "userId");
  const courseId = int(formData, "courseId");
  if (!userId || !courseId) return;

  await db.transaction(async (tx) => {
    // Keep an explicit locked row so revocation remains visible and auditable.
    await tx
      .insert(enrollments)
      .values({ userId, courseId, accessType: "locked" })
      .onConflictDoUpdate({
        target: [enrollments.userId, enrollments.courseId],
        set: { accessType: "locked" },
      });
    await tx
      .update(payments)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.courseId, courseId),
          eq(payments.status, "paid"),
        ),
      );
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/dashboard");
}

export async function grantAccess(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const userId = str(formData, "userId");
  const courseId = int(formData, "courseId");
  const rawMethod = str(formData, "method") as PaymentMethod;
  const method: PaymentMethod = PAYMENT_METHODS.includes(rawMethod) ? rawMethod : "manual";
  if (!userId || !courseId) return;

  // Resolve the amount: a blank uses the list price; an explicit 0 records a
  // complimentary admin grant without inflating revenue.
  const [course] = await db
    .select({ price: courses.price, title: courses.title, slug: courses.slug })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return; // guard against a stale/invalid course id
  // Distinguish "field left blank" (→ book the course price) from an explicit
  // "0" (→ a genuine 0 ₸ comp grant that must NOT inflate revenue).
  const rawAmount = str(formData, "amount");
  const amount =
    rawAmount === "" ? course.price : Math.max(0, Number.parseInt(rawAmount, 10) || 0);

  // Only a genuinely NEW opening earns an email — a re-grant (correcting the
  // amount or the payment method) must not mail the student the same news again.
  const opensAccess = await db.transaction(async (tx) => {
    const [currentCourse] = await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).for("update");
    if (!currentCourse) throw new Error("Курс удалён. Обновите страницу.");
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for("update");
    const [prior] = await tx.select({ accessType: enrollments.accessType }).from(enrollments)
      .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)));
    await tx
      .insert(enrollments)
      .values({ userId, courseId, accessType: "full" })
      .onConflictDoUpdate({
        target: [enrollments.userId, enrollments.courseId],
        set: { accessType: "full" },
      });

    // Convert an open request into a paid payment. If there's no open request,
    // update an already-paid payment in place (idempotent re-grant) rather than
    // inserting a duplicate that would double-count revenue.
    const now = new Date();
    const converted = await tx
      .update(payments)
      .set({ status: "paid", amount, method, updatedAt: now })
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.courseId, courseId),
          eq(payments.status, "requested"),
        ),
      )
      .returning({ id: payments.id });

    if (converted.length === 0) {
      const [existingPaid] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.userId, userId),
            eq(payments.courseId, courseId),
            eq(payments.status, "paid"),
          ),
        )
        .limit(1);

      if (existingPaid) {
        await tx
          .update(payments)
          .set({ amount, method, updatedAt: now })
          .where(eq(payments.id, existingPaid.id));
      } else {
        await tx.insert(payments).values({ userId, courseId, amount, status: "paid", method });
      }
    }
    return prior?.accessType !== "full";
  });

  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/dashboard");

  // Tell the student the course is open — until now they had to guess. Runs
  // AFTER the response and inside a try/catch: a slow or broken mail provider
  // must never delay the grant, and must never fail it.
  if (!opensAccess) return;
  after(async () => {
    try {
      const base = appBaseUrl();
      if (!base) {
        console.error("[grant] APP_URL is not set in production — access email not sent.");
        return;
      }
      const [student] = await db
        .select({ email: profiles.email, name: profiles.fullName })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      if (!student) return;

      const link = `${base}/course/${course.slug}`;
      const hello = student.name ? `, ${student.name.split(" ")[0]}` : "";
      // The student types their own name — it must not be able to inject markup
      // into the HTML part of the email.
      const helloHtml = escapeHtml(hello);
      const titleHtml = escapeHtml(course.title);
      await sendEmail({
        to: student.email,
        subject: `Доступ к курсу «${course.title}» открыт — OQU`,
        text: `Здравствуйте${hello}!\n\nМы открыли вам доступ к курсу «${course.title}». Он уже ждёт вас в личном кабинете:\n${link}\n\nХорошей учёбы!`,
        html: emailLayout(
          "Доступ к курсу открыт",
          `<p>Здравствуйте${helloHtml}!</p>
           <p>Мы открыли вам доступ к курсу <strong style="color:#f4f2ec">«${titleHtml}»</strong> — он уже в вашем личном кабинете.</p>
           <p style="margin:20px 0"><a href="${link}" style="display:inline-block;background:#f5a524;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Перейти к курсу</a></p>
           <p style="color:#6b6b76;font-size:13px">Если кнопка не работает, откройте ссылку: ${link}</p>`,
        ),
      });
    } catch (err) {
      console.error("[grant] access email failed:", err);
    }
  });
}
