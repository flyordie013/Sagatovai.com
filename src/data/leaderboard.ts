import "server-only";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, lessonProgress } from "@/db/schema";
import { levelProgress } from "@/lib/leveling";

export interface LeaderboardRow {
  id: string;
  name: string;
  level: number;
  rank: string;
  xp: number;
  streak: number;
  completed: number;
  isCurrentUser: boolean;
}

const TOP_LIMIT = 20;

/**
 * Топ учеников по XP. Показываем только role='student' — кураторы/админы
 * не соревнуются с учениками и засоряли бы таблицу лидеров.
 * Уровень/ранг ВЫВОДИМ из xp через levelProgress (stored level не берём).
 */
export interface LeaderboardData {
  top: LeaderboardRow[];
  /** The current user's own standing when they're outside the top list. */
  self: (LeaderboardRow & { position: number }) | null;
  totalStudents: number;
}

export async function getLeaderboard(
  currentUserId: string,
): Promise<LeaderboardRow[]> {
  const db = await getDb();

  // Кол-во завершённых уроков на юзера (LEFT JOIN — учитываем и тех, у кого 0).
  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      xp: profiles.xp,
      streak: profiles.currentStreak,
      completed: sql<number>`count(${lessonProgress.id}) filter (where ${lessonProgress.completed} = true)::int`,
    })
    .from(profiles)
    .leftJoin(lessonProgress, eq(lessonProgress.userId, profiles.id))
    .where(eq(profiles.role, "student"))
    .groupBy(profiles.id)
    .orderBy(desc(profiles.xp))
    .limit(TOP_LIMIT);

  return rows.map((r) => {
    const lp = levelProgress(r.xp);
    return {
      id: r.id,
      name: r.fullName,
      level: lp.level,
      rank: lp.rank,
      xp: r.xp,
      streak: r.streak,
      completed: r.completed ?? 0,
      isCurrentUser: r.id === currentUserId,
    };
  });
}

/**
 * Top list plus the current user's own row when they didn't make the cut —
 * otherwise a new student sees a board they never appear on.
 */
export async function getLeaderboardWithSelf(
  currentUserId: string,
): Promise<LeaderboardData> {
  const db = await getDb();
  const top = await getLeaderboard(currentUserId);

  const [totals] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(eq(profiles.role, "student"));
  const totalStudents = totals?.n ?? 0;

  if (top.some((r) => r.isCurrentUser)) {
    return { top, self: null, totalStudents };
  }

  const [me] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      xp: profiles.xp,
      streak: profiles.currentStreak,
      role: profiles.role,
      completed: sql<number>`count(${lessonProgress.id}) filter (where ${lessonProgress.completed} = true)::int`,
    })
    .from(profiles)
    .leftJoin(lessonProgress, eq(lessonProgress.userId, profiles.id))
    .where(eq(profiles.id, currentUserId))
    .groupBy(profiles.id);

  // Staff aren't ranked, so they simply have no standing to show.
  if (!me || me.role !== "student") return { top, self: null, totalStudents };

  const [ahead] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(and(eq(profiles.role, "student"), gt(profiles.xp, me.xp)));

  const lp = levelProgress(me.xp);
  return {
    top,
    self: {
      id: me.id,
      name: me.fullName,
      level: lp.level,
      rank: lp.rank,
      xp: me.xp,
      streak: me.streak,
      completed: me.completed ?? 0,
      isCurrentUser: true,
      position: (ahead?.n ?? 0) + 1,
    },
    totalStudents,
  };
}
