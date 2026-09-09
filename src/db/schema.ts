import {
  pgTable,
  pgEnum,
  serial,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * OQU — Postgres schema (Drizzle ORM).
 * Core learning + gamification tables derived from the platform ТЗ.
 * Additional subsystems (certificates, CRM/leads) extend this file as those
 * modules are built.
 */

export const accessTypeEnum = pgEnum("access_type", ["full", "trial", "locked"]);
export const courseIconEnum = pgEnum("course_icon", ["sparkles", "bot", "code"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "requested",
  "paid",
  "refunded", // a real refund of a paid course
  "declined", // an unpaid request the owner turned down
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "manual",
  "whatsapp",
  "kaspi",
  "card",
]);
export const leadStatusEnum = pgEnum("lead_status", ["new", "contacted", "won", "lost"]);
export const redemptionStatusEnum = pgEnum("redemption_status", [
  "pending",
  "fulfilled",
  "cancelled",
]);
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "curator",
  "admin",
  "superadmin",
]);

/** Users / profiles (mirrors the auth user; profile-level gamification state). */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("student"),
  rank: text("rank").notNull().default("Новичок"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  // Bumped on password change/reset to invalidate all other existing sessions
  // (the token carries this value; a mismatch means the session was revoked).
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Single-use password-reset tokens (only the SHA-256 hash is stored). */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("password_resets_token_idx").on(t.tokenHash),
    index("password_resets_user_idx").on(t.userId),
  ],
);

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  icon: courseIconEnum("icon").notNull().default("sparkles"),
  weeks: integer("weeks").notNull().default(0),
  rating: real("rating").notNull().default(0),
  flagship: boolean("flagship").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  price: integer("price").notNull().default(0),
  totalXp: integer("total_xp").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modules = pgTable(
  "modules",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => [index("modules_course_idx").on(t.courseId)],
);

export const lessons = pgTable(
  "lessons",
  {
    id: serial("id").primaryKey(),
    moduleId: integer("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    content: text("content").notNull().default(""),
    /** External video link (legacy / embeds). Prefer `videoKey` for uploads. */
    videoUrl: text("video_url"),
    /** Storage key of a video uploaded to the platform; served access-checked. */
    videoKey: text("video_key"),
    videoSizeBytes: integer("video_size_bytes"),
    videoMimeType: text("video_mime_type"),
    orderIndex: integer("order_index").notNull().default(0),
    videoDurationSec: integer("video_duration_sec").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("lessons_module_idx").on(t.moduleId)],
);

/** Enrollment grants a user access to a course with a given access tier. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    accessType: accessTypeEnum("access_type").notNull().default("full"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("enrollments_user_course_uidx").on(t.userId, t.courseId)],
);

/** Per-user, per-lesson progress (watch %, completion). */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    watchedPct: integer("watched_pct").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("lesson_progress_user_lesson_uidx").on(t.userId, t.lessonId)],
);

/** Short-term missions / daily challenges. */
export const missions = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  target: integer("target").notNull().default(1),
  xpReward: integer("xp_reward").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const userMissions = pgTable(
  "user_missions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    current: integer("current").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
  },
  (t) => [uniqueIndex("user_missions_uidx").on(t.userId, t.missionId)],
);

/** Achievement catalog + unlock ledger. */
export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  target: integer("target").notNull().default(1),
  xpReward: integer("xp_reward").notNull().default(0),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    achievementId: uuid("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    progress: integer("progress").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("user_achievements_uidx").on(t.userId, t.achievementId)],
);

/** Store: reward items UNLOCKED by reaching an XP threshold (no spend → no XP/level conflict). */
export const storeItems = pgTable("store_items", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("merch"), // merch | guide | video
  xpRequired: integer("xp_required").notNull().default(0),
  icon: text("icon").notNull().default("gift"),
  /** For digital rewards (guide/video): the link the student opens once released. */
  payloadUrl: text("payload_url"),
  isActive: boolean("is_active").notNull().default(true),
});

export const redemptions = pgTable(
  "redemptions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    itemId: integer("item_id")
      .notNull()
      .references(() => storeItems.id, { onDelete: "cascade" }),
    /** Fulfillment state — a claim is a task for the owner, not just a badge. */
    status: redemptionStatusEnum("status").notNull().default("pending"),
    /** Delivery details captured at claim time (size / address / contact). */
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("redemptions_user_item_uidx").on(t.userId, t.itemId)],
);

/** Payments / purchase requests. Revenue = sum of `paid`; leads = `requested`. */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull().default(0), // minor-unit-free KZT
    currency: text("currency").notNull().default("KZT"),
    status: paymentStatusEnum("status").notNull().default("requested"),
    method: paymentMethodEnum("method").notNull().default("manual"),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("payments_user_idx").on(t.userId),
    index("payments_status_idx").on(t.status),
  ],
);

/**
 * Leads from the public storefront — visitors who are NOT registered yet.
 * (`payments.status = 'requested'` covers requests from logged-in students;
 * this table is the anonymous, pre-account funnel.)
 */
export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    contact: text("contact").notNull(), // phone or email as typed
    courseId: integer("course_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    comment: text("comment").notNull().default(""),
    status: leadStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("leads_status_idx").on(t.status), index("leads_created_idx").on(t.createdAt)],
);

export type Profile = typeof profiles.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Module = typeof modules.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
