import "server-only";
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, lessonProgress } from "@/db/schema";
import { levelProgress } from "@/lib/leveling";
import { effectiveStreak } from "@/lib/streak";

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
      lastActivityAt: profiles.lastActivityAt,
      completed: sql<number>`count(${lessonProgress.id}) filter (where ${lessonProgress.completed} = true)::int`,
    })
    .from(profiles)
    .leftJoin(lessonProgress, eq(lessonProgress.userId, profiles.id))
    .where(eq(profiles.role, "student"))
    .groupBy(profiles.id)
    // XP alone is not a total order: with an empty base everyone sits on 0 XP
    // and Postgres is free to return them in any order, so the board reshuffles
    // between requests. Registration date (then id) makes it deterministic and
    // puts the earlier student ahead on a tie. Must stay in sync with the
    // "students ahead of me" count in getLeaderboardWithSelf().
    .orderBy(desc(profiles.xp), asc(profiles.createdAt), asc(profiles.id))
    .limit(TOP_LIMIT);

  return rows.map((r) => {
    const lp = levelProgress(r.xp);
    return {
      id: r.id,
      name: r.fullName,
      level: lp.level,
      rank: lp.rank,
      xp: r.xp,
      streak: effectiveStreak(r.streak, r.lastActivityAt),
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
      lastActivityAt: profiles.lastActivityAt,
      createdAt: profiles.createdAt,
      role: profiles.role,
      completed: sql<number>`count(${lessonProgress.id}) filter (where ${lessonProgress.completed} = true)::int`,
    })
    .from(profiles)
    .leftJoin(lessonProgress, eq(lessonProgress.userId, profiles.id))
    .where(eq(profiles.id, currentUserId))
    .groupBy(profiles.id);

  // Staff aren't ranked, so they simply have no standing to show.
  if (!me || me.role !== "student") return { top, self: null, totalStudents };

  // Everyone strictly ahead of me under the SAME order the top list uses.
  // Counting `xp > me.xp` alone told every student on 0 XP they were 1-й —
  // on an empty platform that's the whole base.
  const [ahead] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(profiles)
    .where(
      and(
        eq(profiles.role, "student"),
        or(
          gt(profiles.xp, me.xp),
          and(eq(profiles.xp, me.xp), lt(profiles.createdAt, me.createdAt)),
          and(
            eq(profiles.xp, me.xp),
            eq(profiles.createdAt, me.createdAt),
            lt(profiles.id, me.id),
          ),
        ),
      ),
    );

  const lp = levelProgress(me.xp);
  return {
    top,
    self: {
      id: me.id,
      name: me.fullName,
      level: lp.level,
      rank: lp.rank,
      xp: me.xp,
      streak: effectiveStreak(me.streak, me.lastActivityAt),
      completed: me.completed ?? 0,
      isCurrentUser: true,
      position: (ahead?.n ?? 0) + 1,
    },
    totalStudents,
  };
}
