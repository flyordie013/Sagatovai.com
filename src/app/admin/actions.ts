"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  courses,
  modules,
  lessons,
  enrollments,
  payments,
  profiles,
  missions,
  userMissions,
  achievements,
  storeItems,
  redemptions,
  leads,
} from "@/db/schema";
import { requireStaff } from "@/lib/session";
import { hashPassword } from "@/lib/password";
import { provisionNewStudent } from "@/lib/provision";
import { deleteVideo } from "@/lib/storage";
import { MIN_PASSWORD } from "@/lib/auth-rules";

/** Removes uploaded video files for a set of storage keys (best-effort). */
async function purgeVideos(keys: (string | null)[]): Promise<void> {
  await Promise.all(keys.filter((k): k is string => Boolean(k)).map((k) => deleteVideo(k)));
}

type PaymentMethod = "manual" | "whatsapp" | "kaspi" | "card";
const PAYMENT_METHODS: readonly PaymentMethod[] = ["manual", "whatsapp", "kaspi", "card"];

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
      icon: ((str(formData, "icon") || "sparkles") as Icon),
      weeks: int(formData, "weeks"),
      price: int(formData, "price"),
      flagship: bool(formData, "flagship"),
      isPublished: bool(formData, "isPublished"),
      orderIndex: 999,
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
  const isPublished = existing?.isArchived ? false : bool(formData, "isPublished");

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
      icon: ((str(formData, "icon") || "sparkles") as Icon),
      weeks: int(formData, "weeks"),
      price: int(formData, "price"),
      flagship: bool(formData, "flagship"),
      isPublished,
    })
    .where(eq(courses.id, id));

  revalidateCourse(id);
}

export async function togglePublish(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  if (!id) return;
  await db
    .update(courses)
    .set({ isPublished: bool(formData, "next") })
    .where(eq(courses.id, id));
  revalidateCourse(id);
}

export async function deleteCourse(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const id = int(formData, "courseId");
  if (!id) return;

  // A course with payment history is ARCHIVED, not deleted — a hard delete would
  // cascade its payments away and silently erase booked revenue. Archived
  // courses are hidden from students but keep their sales records. Empty
  // (never-sold) courses are deleted outright.
  const [{ n: paid }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.courseId, id));

  if (paid > 0) {
    // Archived — keep the content (and its video files) intact.
    await db
      .update(courses)
      .set({ isArchived: true, isPublished: false })
      .where(eq(courses.id, id));
  } else {
    // Hard delete: collect the uploaded video files first, then cascade-remove
    // modules/lessons/enrollments and free the files from disk.
    const keys = await db
      .select({ videoKey: lessons.videoKey })
      .from(lessons)
      .innerJoin(modules, eq(lessons.moduleId, modules.id))
      .where(eq(modules.courseId, id));
    await db.delete(courses).where(eq(courses.id, id));
    await purgeVideos(keys.map((k) => k.videoKey));
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
  const keys = await db
    .select({ videoKey: lessons.videoKey })
    .from(lessons)
    .where(eq(lessons.moduleId, id));
  await db.delete(modules).where(eq(modules.id, id)); // cascade removes lessons
  await purgeVideos(keys.map((k) => k.videoKey));
  revalidateCourse(courseId);
}

/* ------------------------------ lessons ------------------------------ */

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

  await db
    .update(lessons)
    .set({
      title,
      description: str(formData, "description"),
      content: str(formData, "content"),
      videoUrl: str(formData, "videoUrl") || null,
      videoDurationSec: int(formData, "videoDurationSec"),
      isFree: bool(formData, "isFree"),
    })
    .where(eq(lessons.id, id));

  revalidateCourse(courseId);
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
  const [lesson] = await db
    .select({ videoKey: lessons.videoKey })
    .from(lessons)
    .where(eq(lessons.id, id))
    .limit(1);
  await db.delete(lessons).where(eq(lessons.id, id));
  await purgeVideos([lesson?.videoKey ?? null]); // free the uploaded file
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

export async function createAchievement(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();
  const title = str(formData, "title");
  if (!title) return;
  const code = slugCode(str(formData, "code") || title, "ach");

  await db
    .insert(achievements)
    .values({
      code,
      title,
      description: str(formData, "description"),
      target: Math.max(1, int(formData, "target", 1)),
      xpReward: Math.max(0, int(formData, "xpReward")),
    })
    .onConflictDoNothing({ target: achievements.code });

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
const ROLES: readonly Role[] = ["student", "curator", "admin", "superadmin"];

/**
 * Creates an account on behalf of a customer (e.g. after a Kaspi/WhatsApp
 * payment). The owner sets the initial password and relays it to the student.
 */
export async function createUser(formData: FormData): Promise<void> {
  await requireStaff();
  const db = await getDb();

  const fullName = str(formData, "fullName");
  const email = str(formData, "email").toLowerCase();
  const password = (formData.get("password") ?? "").toString();
  const rawRole = str(formData, "role") as Role;
  const role: Role = ROLES.includes(rawRole) ? rawRole : "student";

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

/* --------------------------- access / payments --------------------------- */

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
    // Set the enrollment to "locked" rather than DELETING it — deleting a row
    // for a FREE published course would fall back to the "free → full" rule and
    // silently re-grant access. An explicit "locked" enrollment overrides that.
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

  // Resolve the amount: clamp to >= 0, and when left at 0 fall back to the
  // course's list price so a manual grant still books realistic revenue.
  const [course] = await db
    .select({ price: courses.price })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return; // guard against a stale/invalid course id
  // Distinguish "field left blank" (→ book the course price) from an explicit
  // "0" (→ a genuine 0 ₸ comp grant that must NOT inflate revenue).
  const rawAmount = str(formData, "amount");
  const amount =
    rawAmount === "" ? course.price : Math.max(0, Number.parseInt(rawAmount, 10) || 0);

  // grant full access (idempotent)
  await db
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
  const converted = await db
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
    const [existingPaid] = await db
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
      await db
        .update(payments)
        .set({ amount, method, updatedAt: now })
        .where(eq(payments.id, existingPaid.id));
    } else {
      await db.insert(payments).values({ userId, courseId, amount, status: "paid", method });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/requests");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/dashboard");
}
