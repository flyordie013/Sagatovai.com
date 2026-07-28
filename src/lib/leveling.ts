/**
 * XP → level → rank system. Single source of truth is a user's total `xp`;
 * `level`/`rank` are derived (and denormalized on write for admin/leaderboard).
 */

const RANKS = [
  "Новичок", // 1
  "Ученик", // 2
  "Практик", // 3
  "Интегратор", // 4
  "Специалист", // 5
  "Мастер", // 6
  "Эксперт", // 7
  "Гуру", // 8
  "Легенда", // 9+
];

/** XP awarded for completing one lesson. */
export const XP_PER_LESSON = 25;

/** Cumulative XP required to REACH `level` (level 1 = 0, 2 = 100, 3 = 300, …). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 50 * (l - 1) * l;
}

export function levelForXp(xp: number): number {
  const safe = Math.max(0, xp);
  let level = 1;
  while (xpForLevel(level + 1) <= safe) level += 1;
  return level;
}

export function rankForLevel(level: number): string {
  const idx = Math.min(Math.max(1, level), RANKS.length) - 1;
  return RANKS[idx];
}

export interface LevelProgress {
  level: number;
  rank: string;
  xpIntoLevel: number;
  xpSpan: number;
  xpToNext: number;
  percent: number;
}

/** Progress within the current level for a given absolute XP. */
export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const xpSpan = next - base;
  const xpIntoLevel = Math.max(0, xp - base);
  const xpToNext = Math.max(0, next - xp);
  const percent = xpSpan > 0 ? Math.round((xpIntoLevel / xpSpan) * 100) : 0;
  return { level, rank: rankForLevel(level), xpIntoLevel, xpSpan, xpToNext, percent };
}
