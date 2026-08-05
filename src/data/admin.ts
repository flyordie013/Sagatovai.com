import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { requireStaff } from "@/lib/session";
import { effectiveStreak } from "@/lib/streak";
import {
  courses,
  modules,
  lessons,
  enrollments,
  lessonProgress,
  profiles,
  payments,
  leads,
  missions,
  achievements,
  storeItems,
  redemptions,
} from "@/db/schema";

const countInt = sql<number>`count(*)::int`;

export interface AdminStats {
  students: number;
  admins: number;
  courses: number;
  publishedCourses: number;
  lessons: number;
  enrollments: number;
  purchases: number;
  revenue: number;
  /** Purchase REQUESTS from registered students (payments.status = requested). */
  openRequests: number;
  /** Storefront LEADS from visitors without an account (leads.status = new). */
  newLeads: number;
  leadsTotal: number;
  completedLessons: number;
  activeLearners: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  await requireStaff();
  const db = await getDb();

  const one = async (q: Promise<{ v: number }[]>) => (await q)[0]?.v ?? 0;

  const [
    students,
    admins,
    courseCount,
    publishedCourses,
    lessonCount,
    enrollmentCount,
    completedLessons,
  ] = await Promise.all([
    one(db.select({ v: countInt }).from(profiles).where(eq(profiles.role, "student"))),
    one(db.select({ v: countInt }).from(profiles).where(sql`${profiles.role} in ('admin','superadmin')`)),
    one(db.select({ v: countInt }).from(courses)),
    one(db.select({ v: countInt }).from(courses).where(eq(courses.isPublished, true))),
    one(db.select({ v: countInt }).from(lessons)),
    one(db.select({ v: countInt }).from(enrollments)),
    one(db.select({ v: countInt }).from(lessonProgress).where(eq(lessonProgress.completed, true))),
  ]);

  // Real revenue = recorded paid payments (not inferred from course price).
  // `count` only counts payments that actually brought money in — a 0 ₸ manual
  // grant is an access grant, not a sale, and must not inflate "покупок".
  const [paidAgg] = await db
    .select({
      count: sql<number>`count(*) filter (where ${payments.amount} > 0)::int`,
      revenue: sql<number>`coalesce(sum(${payments.amount}), 0)::int`,
    })
    .from(payments)
    .where(eq(payments.status, "paid"));

  // Two different funnels, deliberately named apart: "запросы на доступ" come
  // from registered students, "лиды" from anonymous storefront visitors.
  const [openRequests, newLeads, leadsTotal] = await Promise.all([
    one(db.select({ v: countInt }).from(payments).where(eq(payments.status, "requested"))),
    one(db.select({ v: countInt }).from(leads).where(eq(leads.status, "new"))),
    one(db.select({ v: countInt }).from(leads)),
  ]);

  // Shown under the "Студентов" tile, so it must count students only —
  // otherwise staff testing lessons would be reported as active learners.
  const activeLearners = await one(
    db
      .select({ v: sql<number>`count(distinct ${lessonProgress.userId})::int` })
      .from(lessonProgress)
      .innerJoin(profiles, eq(lessonProgress.userId, profiles.id))
      .where(and(eq(lessonProgress.completed, true), eq(profiles.role, "student"))),
  );

  return {
    students,
    admins,
    courses: courseCount,
    publishedCourses,
    lessons: lessonCount,
    enrollments: enrollmentCount,
    purchases: paidAgg?.count ?? 0,
    revenue: paidAgg?.revenue ?? 0,
    openRequests,
    newLeads,
    leadsTotal,
    completedLessons,
    activeLearners,
  };
}

export interface AdminBadgeCounts {
  newLeads: number;
  openRequests: number;
}

/**
 * The two "someone is waiting for you" counters shown as sidebar badges.
 * Kept separate from `getAdminStats` because the layout runs it on EVERY admin
 * page — two counts, not a dozen aggregates.
 */
export async function getAdminBadgeCounts(): Promise<AdminBadgeCounts> {
  await requireStaff();
  const db = await getDb();

  const [newLeads, openRequests] = await Promise.all([
    db.select({ v: countInt }).from(leads).where(eq(leads.status, "new")),
    db.select({ v: countInt }).from(payments).where(eq(payments.status, "requested")),
  ]);

  return { newLeads: newLeads[0]?.v ?? 0, openRequests: openRequests[0]?.v ?? 0 };
}

export interface PurchaseRequest {
  id: number;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: number;
  courseTitle: string;
  coursePrice: number;
  amount: number;
  createdAt: Date;
}

export async function getPurchaseRequests(): Promise<PurchaseRequest[]> {
  await requireStaff();
  const db = await getDb();
  return db
    .select({
      id: payments.id,
      userId: payments.userId,
      userName: profiles.fullName,
      userEmail: profiles.email,
      courseId: payments.courseId,
      courseTitle: courses.title,
      coursePrice: courses.price,
      amount: payments.amount,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(profiles, eq(payments.userId, profiles.id))
    .innerJoin(courses, eq(payments.courseId, courses.id))
    .where(eq(payments.status, "requested"))
    .orderBy(desc(payments.createdAt));
}

export interface LeadRow {
  id: number;
  name: string;
  contact: string;
  comment: string;
  status: "new" | "contacted" | "won" | "lost";
  courseTitle: string | null;
  createdAt: Date;
}

/** Leads captured from the public storefront (visitors without an account). */
export async function listLeads(): Promise<LeadRow[]> {
  await requireStaff();
  const db = await getDb();
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      contact: leads.contact,
      comment: leads.comment,
      status: leads.status,
      courseTitle: courses.title,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(courses, eq(leads.courseId, courses.id))
    .orderBy(desc(leads.createdAt));
  return rows as LeadRow[];
}

/** Everything the gamification admin screen needs, in one call. */
export async function getGamification() {
  await requireStaff();
  const db = await getDb();

  const [missionRows, achievementRows, itemRows, redemptionRows] = await Promise.all([
    db.select().from(missions).orderBy(asc(missions.title)),
    db.select().from(achievements).orderBy(asc(achievements.target)),
    db.select().from(storeItems).orderBy(asc(storeItems.xpRequired)),
    db
      .select({
        id: redemptions.id,
        status: redemptions.status,
        note: redemptions.note,
        createdAt: redemptions.createdAt,
        itemName: storeItems.name,
        category: storeItems.category,
        userName: profiles.fullName,
        userEmail: profiles.email,
      })
      .from(redemptions)
      .innerJoin(storeItems, eq(redemptions.itemId, storeItems.id))
      .innerJoin(profiles, eq(redemptions.userId, profiles.id))
      .orderBy(desc(redemptions.createdAt)),
  ]);

  return {
    missions: missionRows,
    achievements: achievementRows,
    items: itemRows,
    redemptions: redemptionRows,
  };
}

export interface AdminCourseRow {
  id: number;
  slug: string;
  title: string;
  icon: string;
  isPublished: boolean;
  isArchived: boolean;
  flagship: boolean;
  price: number;
  modules: number;
  lessons: number;
  students: number;
}

export async function listCourses(): Promise<AdminCourseRow[]> {
  await requireStaff();
  const db = await getDb();

  // `id` tiebreaker → the list matches the order `moveCourse` reindexes, even
  // while several courses still share a legacy orderIndex.
  const rows = await db.select().from(courses).orderBy(asc(courses.orderIndex), asc(courses.id));

  const moduleCounts = await db
    .select({ courseId: modules.courseId, v: countInt })
    .from(modules)
    .groupBy(modules.courseId);
  const lessonCounts = await db
    .select({ courseId: modules.courseId, v: sql<number>`count(${lessons.id})::int` })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  const studentCounts = await db
    .select({ courseId: enrollments.courseId, v: countInt })
    .from(enrollments)
    .groupBy(enrollments.courseId);

  const mMap = new Map(moduleCounts.map((r) => [r.courseId, r.v]));
  const lMap = new Map(lessonCounts.map((r) => [r.courseId, r.v]));
  const sMap = new Map(studentCounts.map((r) => [r.courseId, r.v]));

  return rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    icon: c.icon,
    isPublished: c.isPublished,
    isArchived: c.isArchived,
    flagship: c.flagship,
    price: c.price,
    modules: mMap.get(c.id) ?? 0,
    lessons: lMap.get(c.id) ?? 0,
    students: sMap.get(c.id) ?? 0,
  }));
}

export async function getCourseForAdmin(courseId: number) {
  await requireStaff();
  const db = await getDb();
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) return null;

  const mods = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.orderIndex);

  const allLessons = await db
    .select()
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(lessons.orderIndex);

  const lessonsByModule = new Map<number, typeof lessons.$inferSelect[]>();
  for (const row of allLessons) {
    const list = lessonsByModule.get(row.lessons.moduleId) ?? [];
    list.push(row.lessons);
    lessonsByModule.set(row.lessons.moduleId, list);
  }

  return {
    course,
    modules: mods.map((m) => ({ ...m, lessons: lessonsByModule.get(m.id) ?? [] })),
  };
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  role: string;
  rank: string;
  level: number;
  xp: number;
  currentStreak: number;
  courses: number;
  completed: number;
}

export interface UsersPage {
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

const USERS_PAGE_SIZE = 30;

/** Paginated + searchable user list (by name or email). */
export async function listUsers(opts: { q?: string; page?: number } = {}): Promise<UsersPage> {
  await requireStaff();
  const db = await getDb();

  const q = (opts.q ?? "").trim();
  const page = Math.max(1, opts.page ?? 1);
  const filter = q
    ? sql`(${profiles.fullName} ilike ${"%" + q + "%"} or ${profiles.email} ilike ${"%" + q + "%"})`
    : undefined;

  const [{ n: total }] = await db
    .select({ n: countInt })
    .from(profiles)
    .where(filter);

  const rows = await db
    .select()
    .from(profiles)
    .where(filter)
    // `id` tiebreaker → stable order across pages (xp defaults to 0, so many
    // users tie; without this, equal-xp rows can duplicate or vanish at page
    // boundaries).
    .orderBy(desc(profiles.xp), asc(profiles.id))
    .limit(USERS_PAGE_SIZE)
    .offset((page - 1) * USERS_PAGE_SIZE);

  const ids = rows.map((r) => r.id);
  const eMap = new Map<string, number>();
  const cMap = new Map<string, number>();
  if (ids.length > 0) {
    const enrollCounts = await db
      .select({ userId: enrollments.userId, v: countInt })
      .from(enrollments)
      .where(inArray(enrollments.userId, ids))
      .groupBy(enrollments.userId);
    const completedCounts = await db
      .select({ userId: lessonProgress.userId, v: countInt })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.completed, true), inArray(lessonProgress.userId, ids)))
      .groupBy(lessonProgress.userId);
    enrollCounts.forEach((r) => eMap.set(r.userId, r.v));
    completedCounts.forEach((r) => cMap.set(r.userId, r.v));
  }

  return {
    total,
    page,
    pageSize: USERS_PAGE_SIZE,
    rows: rows.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.email,
      role: p.role,
      rank: p.rank,
      level: p.level,
      xp: p.xp,
      // The stored column is only rewritten when a lesson is completed, so it
      // keeps showing a long-broken streak. The student's own cabinet burns it
      // out — the admin list must show the same number.
      currentStreak: effectiveStreak(p.currentStreak, p.lastActivityAt),
      courses: eMap.get(p.id) ?? 0,
      completed: cMap.get(p.id) ?? 0,
    })),
  };
}

export async function getUserForAdmin(userId: string) {
  const me = await requireStaff();
  const db = await getDb();
  const [user] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!user) return null;

  // Guards mirrored from updateUser/deleteUser so the UI can grey the controls
  // out instead of letting the owner press a button that silently does nothing.
  const [{ n: superadmins }] = await db
    .select({ n: countInt })
    .from(profiles)
    .where(eq(profiles.role, "superadmin"));
  const isSelf = user.id === me.userId;
  const lastOwner = user.role === "superadmin" && superadmins <= 1;

  const enrolled = await db
    .select({
      courseId: courses.id,
      title: courses.title,
      slug: courses.slug,
      price: courses.price,
      accessType: enrollments.accessType,
      enrolledAt: enrollments.createdAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(eq(enrollments.userId, userId))
    .orderBy(courses.orderIndex);

  // completed lessons per course for this user
  const perCourse = await db
    .select({
      courseId: modules.courseId,
      done: sql<number>`count(${lessonProgress.id})::int`,
    })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.completed, true)))
    .groupBy(modules.courseId);
  const doneMap = new Map(perCourse.map((r) => [r.courseId, r.done]));

  const totalPerCourse = await db
    .select({
      courseId: modules.courseId,
      total: sql<number>`count(${lessons.id})::int`,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .groupBy(modules.courseId);
  const totalMap = new Map(totalPerCourse.map((r) => [r.courseId, r.total]));

  const enrollments2 = enrolled.map((e) => {
    const total = totalMap.get(e.courseId) ?? 0;
    const done = doneMap.get(e.courseId) ?? 0;
    return {
      ...e,
      total,
      done,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      purchased: e.price > 0 && e.accessType === "full",
    };
  });

  const userPayments = await db
    .select({
      id: payments.id,
      courseId: payments.courseId,
      courseTitle: courses.title,
      amount: payments.amount,
      status: payments.status,
      method: payments.method,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(courses, eq(payments.courseId, courses.id))
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));

  const totalCompleted = [...doneMap.values()].reduce((a, b) => a + b, 0);
  const paid = userPayments.filter((p) => p.status === "paid");
  const spent = paid.reduce((sum, p) => sum + p.amount, 0);

  return {
    // Same burnt-out streak the student sees in their own cabinet — the raw
    // column lags behind until the next completed lesson.
    user: { ...user, currentStreak: effectiveStreak(user.currentStreak, user.lastActivityAt) },
    isSelf,
    /** Can this account be deleted at all? */
    canDelete: !isSelf && !lastOwner,
    /** Can its role be changed at all? */
    canChangeRole: !isSelf && !lastOwner,
    /** Only an owner hands out the owner role. */
    canGrantOwner: me.role === "superadmin",
    enrollments: enrollments2,
    totalCompleted,
    payments: userPayments,
    // A 0 ₸ comp grant is an access grant, not a purchase — match the global
    // «Покупок» rule (amount > 0) so the two surfaces agree.
    paidCount: paid.filter((p) => p.amount > 0).length,
    spent,
  };
}
