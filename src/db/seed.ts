import "server-only";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { DEV_USER_ID } from "./constants";
import { hashPassword } from "@/lib/password";
import { levelForXp, rankForLevel } from "@/lib/leveling";

type DB = PgliteDatabase<typeof schema>;

const {
  profiles,
  courses,
  modules,
  lessons,
  enrollments,
  missions,
  userMissions,
  lessonProgress,
  achievements,
  userAchievements,
  storeItems,
  payments,
} = schema;

// Self-hosted sample clip (public/) so the lesson player always loads in development.
const SAMPLE_VIDEO = "/sample-lesson.mp4";

const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const ASKAR_ID = "00000000-0000-4000-8000-000000000002";
const AIGERIM_ID = "00000000-0000-4000-8000-000000000003";
const DARIA_ID = "00000000-0000-4000-8000-000000000004";
const TIMUR_ID = "00000000-0000-4000-8000-000000000005";

/**
 * Seeds demo content + demo users on an empty database.
 *
 * DEVELOPMENT ONLY — these accounts use well-known passwords. Production is
 * bootstrapped with `pnpm db:bootstrap` instead (see scripts/bootstrap-admin.ts).
 * Idempotent.
 */
export async function seedIfEmpty(db: DB): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Refusing to seed demo accounts in production — they use publicly known " +
        "passwords. Use `pnpm db:bootstrap` to create the first owner instead.",
    );
  }

  const existing = await db.select({ id: courses.id }).from(courses).limit(1);
  if (existing.length > 0) return;

  const now = new Date();

  // ---- users ----------------------------------------------------------------
  // Overridable so local demo credentials never have to live in source control.
  const ownerHash = await hashPassword(process.env.SEED_OWNER_PASSWORD || "owner12345");
  const studentHash = await hashPassword(
    process.env.SEED_STUDENT_PASSWORD || "student12345",
  );
  const usersData: (typeof profiles.$inferInsert)[] = [
    {
      id: OWNER_ID,
      fullName: "Владелец платформы",
      email: "owner@oqu.academy",
      role: "superadmin",
      rank: "Основатель",
      level: 9,
      xp: 24000,
      currentStreak: 30,
      longestStreak: 45,
      lastActivityAt: now,
    },
    {
      id: DEV_USER_ID,
      fullName: "Данияр Ахметов",
      email: "daniyar.a@gmail.com",
      role: "student",
      rank: "Интегратор II",
      level: 2,
      xp: 100,
      currentStreak: 0,
      longestStreak: 3,
      lastActivityAt: now,
    },
    {
      id: ASKAR_ID,
      fullName: "Аскар Болатов",
      email: "askar.b@gmail.com",
      role: "student",
      rank: "Мастер",
      level: 5,
      xp: 4200,
      currentStreak: 12,
      longestStreak: 18,
      lastActivityAt: now,
    },
    {
      id: AIGERIM_ID,
      fullName: "Айгерим Тлеубаева",
      email: "aigerim.t@gmail.com",
      role: "student",
      rank: "Практик",
      level: 3,
      xp: 1400,
      currentStreak: 4,
      longestStreak: 9,
      lastActivityAt: now,
    },
    {
      id: DARIA_ID,
      fullName: "Дарья Ким",
      email: "daria.k@gmail.com",
      role: "student",
      rank: "Практик II",
      level: 4,
      xp: 2600,
      currentStreak: 7,
      longestStreak: 11,
      lastActivityAt: now,
    },
    {
      id: TIMUR_ID,
      fullName: "Тимур Жаксыбеков",
      email: "timur.zh@gmail.com",
      role: "student",
      rank: "Новичок",
      level: 1,
      xp: 40,
      currentStreak: 1, // completed a lesson today → streak is live
      longestStreak: 1,
      lastActivityAt: now,
    },
  ];
  await db.insert(profiles).values(
    usersData.map((u) => {
      const level = levelForXp(u.xp ?? 0);
      return {
        ...u,
        passwordHash: u.role === "superadmin" ? ownerHash : studentHash,
        level,
        rank: rankForLevel(level),
      };
    }),
  );

  // ---- courses --------------------------------------------------------------
  const courseRows = await db
    .insert(courses)
    .values([
      {
        slug: "creator",
        title: "Креатор 2.0",
        description: "Контент с помощью AI: тексты, картинки, видео",
        icon: "sparkles",
        weeks: 2,
        rating: 4.8,
        flagship: false,
        orderIndex: 1,
        isPublished: true,
        price: 0,
        totalXp: 600,
      },
      {
        slug: "integrator",
        title: "ИИ-Менеджер продаж",
        description: "Чат-боты, CRM и автоматизация",
        icon: "bot",
        weeks: 4,
        rating: 4.9,
        flagship: true,
        orderIndex: 2,
        isPublished: true,
        price: 120000,
        totalXp: 3000,
      },
      {
        slug: "programmer",
        title: "Вайб-кодер",
        description: "Vibe-coding с AI: от идеи до production",
        icon: "code",
        weeks: 4,
        rating: 5.0,
        flagship: false,
        orderIndex: 3,
        isPublished: true,
        price: 0,
        totalXp: 1200,
      },
    ])
    .returning({ id: courses.id, slug: courses.slug });

  const courseId = Object.fromEntries(courseRows.map((c) => [c.slug, c.id]));

  // ---- modules + lessons ----------------------------------------------------
  async function seedModules(
    cid: number,
    mods: { title: string; lessons: string[] }[],
  ): Promise<number[]> {
    const lessonIds: number[] = [];
    let mi = 0;
    for (const m of mods) {
      const [mod] = await db
        .insert(modules)
        .values({ courseId: cid, title: m.title, orderIndex: mi++ })
        .returning({ id: modules.id });
      let li = 0;
      for (const title of m.lessons) {
        const [les] = await db
          .insert(lessons)
          .values({
            moduleId: mod.id,
            title,
            description: "Короткий разбор темы урока с практикой.",
            content:
              "В этом уроке разбираем тему шаг за шагом. Посмотри видео до конца, затем переходи к следующему уроку.",
            videoUrl: SAMPLE_VIDEO,
            orderIndex: li,
            videoDurationSec: 240 + li * 45,
          })
          .returning({ id: lessons.id });
        lessonIds.push(les.id);
        li++;
      }
    }
    return lessonIds;
  }

  const creatorLessons = await seedModules(courseId.creator, [
    {
      title: "Формат видео Storytelling",
      lessons: [
        "Введение в формат Storytelling",
        "Сценарий и генерация кадров в Midjourney",
        "Оживление кадров для видео",
      ],
    },
    {
      title: "Практика и монтаж",
      lessons: ["Озвучка для видео", "Монтаж в CapCut", "Монетизация контента"],
    },
  ]);

  await seedModules(courseId.integrator, [
    {
      title: "GPT-боты и интеграции",
      lessons: ["Основы GPT-ботов", "Подключение к мессенджеру", "Интеграция с CRM"],
    },
    {
      title: "Автоматизация",
      lessons: ["Сценарии в Make", "Воркфлоу в n8n", "Разогрев холодной базы"],
    },
    {
      title: "Упаковка и продажи",
      lessons: ["Упаковка услуги", "Продвижение", "Кейсы и офферы"],
    },
  ]);

  const programmerLessons = await seedModules(courseId.programmer, [
    {
      title: "Основы vibe-coding",
      lessons: [
        "VSCode с AI-ассистентом",
        "Claude Code и Codex",
        "MCP и sub-agents",
        "Skills и автоматизация",
      ],
    },
    {
      title: "Production",
      lessons: ["React + TypeScript", "Node.js API", "Деплой на production", "CI/CD"],
    },
  ]);

  // ---- enrollments (access / purchases) ------------------------------------
  await db.insert(enrollments).values([
    // Данияр: access granted to two courses, integrator locked
    { userId: DEV_USER_ID, courseId: courseId.creator, accessType: "full" },
    { userId: DEV_USER_ID, courseId: courseId.programmer, accessType: "full" },
    { userId: DEV_USER_ID, courseId: courseId.integrator, accessType: "locked" },
    // Аскар: purchased the flagship (full access to paid course)
    { userId: ASKAR_ID, courseId: courseId.creator, accessType: "full" },
    { userId: ASKAR_ID, courseId: courseId.programmer, accessType: "full" },
    { userId: ASKAR_ID, courseId: courseId.integrator, accessType: "full" },
    // Дарья: purchased the flagship too
    { userId: DARIA_ID, courseId: courseId.creator, accessType: "full" },
    { userId: DARIA_ID, courseId: courseId.programmer, accessType: "full" },
    { userId: DARIA_ID, courseId: courseId.integrator, accessType: "full" },
    // Айгерим: access granted to one course
    { userId: AIGERIM_ID, courseId: courseId.creator, accessType: "full" },
    { userId: AIGERIM_ID, courseId: courseId.integrator, accessType: "locked" },
    // Тимур: just started
    { userId: TIMUR_ID, courseId: courseId.creator, accessType: "full" },
  ]);

  // ---- lesson progress ------------------------------------------------------
  const done = (userId: string, lessonId: number) => ({
    userId,
    lessonId,
    watchedPct: 100,
    completed: true,
    completedAt: now,
  });

  await db.insert(lessonProgress).values([
    // Аскар — прошёл весь Креатор + часть Вайб-кодера
    ...creatorLessons.map((id) => done(ASKAR_ID, id)),
    ...programmerLessons.slice(0, 3).map((id) => done(ASKAR_ID, id)),
    // Дарья — часть Креатора и Вайб-кодера
    ...creatorLessons.slice(0, 4).map((id) => done(DARIA_ID, id)),
    ...programmerLessons.slice(0, 2).map((id) => done(DARIA_ID, id)),
    // Айгерим — начало Креатора
    ...creatorLessons.slice(0, 3).map((id) => done(AIGERIM_ID, id)),
    // Тимур — 1 урок
    ...creatorLessons.slice(0, 1).map((id) => done(TIMUR_ID, id)),
  ]);

  // ---- missions -------------------------------------------------------------
  const [mission] = await db
    .insert(missions)
    .values({
      title: "Первый шаг",
      description: "Заверши свой первый урок",
      target: 1,
      xpReward: 50,
      isActive: true,
    })
    .returning({ id: missions.id });

  // Assign the mission to every student, with progress derived from how many
  // lessons they've completed (target = 1 → anyone with ≥1 completion is done).
  const missionProgress: Record<string, number> = {
    [DEV_USER_ID]: 0,
    [ASKAR_ID]: 9,
    [AIGERIM_ID]: 3,
    [DARIA_ID]: 6,
    [TIMUR_ID]: 1,
  };
  await db.insert(userMissions).values(
    Object.entries(missionProgress).map(([userId, doneCount]) => ({
      userId,
      missionId: mission.id,
      current: Math.min(doneCount, 1),
      completed: doneCount >= 1,
    })),
  );

  // ---- achievements (lesson-count based) ------------------------------------
  const achRows = await db
    .insert(achievements)
    .values([
      { code: "first_lesson", title: "Первый урок", description: "Заверши свой первый урок", target: 1, xpReward: 20 },
      { code: "five_lessons", title: "Разгон", description: "Заверши 5 уроков", target: 5, xpReward: 50 },
      { code: "ten_lessons", title: "Марафонец", description: "Заверши 10 уроков", target: 10, xpReward: 100 },
    ])
    .returning({ id: achievements.id, target: achievements.target });

  // Materialize the achievement ledger for seeded users (their lessons were
  // seeded directly, bypassing completeLesson) so every screen agrees.
  const completedByUser: Record<string, number> = {
    [ASKAR_ID]: 9,
    [DARIA_ID]: 6,
    [AIGERIM_ID]: 3,
    [TIMUR_ID]: 1,
  };
  const unlockedRows = Object.entries(completedByUser).flatMap(([userId, done]) =>
    achRows
      .filter((a) => a.target <= done)
      .map((a) => ({ userId, achievementId: a.id, progress: a.target, unlockedAt: now })),
  );
  if (unlockedRows.length) await db.insert(userAchievements).values(unlockedRows);

  // ---- payments (real sales + one open request) -----------------------------
  await db.insert(payments).values([
    { userId: ASKAR_ID, courseId: courseId.integrator, amount: 120000, status: "paid", method: "manual", note: "Оплата подтверждена менеджером" },
    { userId: DARIA_ID, courseId: courseId.integrator, amount: 120000, status: "paid", method: "manual", note: "Оплата подтверждена менеджером" },
    { userId: TIMUR_ID, courseId: courseId.integrator, amount: 120000, status: "requested", method: "manual", note: "Заявка из каталога" },
  ]);

  // ---- store: reward items unlocked by accumulated XP ------------------------
  await db.insert(storeItems).values([
    { code: "sticker_pack", name: "Набор стикеров OQU", description: "Фирменные стикеры", category: "merch", xpRequired: 150, icon: "sticker" },
    { code: "prompt_guide", name: "Гайд: 50 промптов", description: "PDF со скриптами промптов для работы", category: "guide", xpRequired: 300, icon: "book" },
    { code: "tshirt", name: "Футболка OQU", description: "Мерч для настоящих билдеров", category: "merch", xpRequired: 800, icon: "shirt" },
    { code: "masterclass", name: "Запись мастер-класса", description: "Эксклюзивный видео-урок от эксперта", category: "video", xpRequired: 1500, icon: "video" },
  ]);
}
