/**
 * Streak (consecutive active days).
 *
 * A "day" is a calendar day in Asia/Almaty — the audience is in Kazakhstan, and
 * relying on the process timezone would put the day boundary at 05:00 local
 * (a container runs on UTC). Every read and write of `currentStreak` goes
 * through here so the platform never disagrees with itself about "today".
 */

const TIMEZONE = "Asia/Almaty";

const dayFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day of `date` in Asia/Almaty, as a day count since the epoch. */
function dayNumber(date: Date): number {
  const parts = dayFormat.formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Math.round(Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000);
}

/** Whole calendar days between two instants, counted in Asia/Almaty. */
export function calendarDayDiff(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from);
}

/**
 * The streak as it must be SHOWN. `profiles.current_streak` is only rewritten
 * when a lesson is completed, so a student who disappeared for a month still
 * carries the old number in the column — anything older than yesterday is a
 * broken streak and reads as 0. A future `lastActivityAt` (clock skew between
 * app and database) is treated as fresh rather than as a break.
 */
export function effectiveStreak(
  storedStreak: number,
  lastActivityAt: Date | null | undefined,
): number {
  if (!lastActivityAt) return 0;
  return calendarDayDiff(lastActivityAt, new Date()) <= 1 ? storedStreak : 0;
}
