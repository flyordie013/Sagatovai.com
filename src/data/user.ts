import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { levelProgress } from "@/lib/leveling";
import { effectiveStreak } from "@/lib/streak";
import type { UserSummary } from "@/types";

export async function getCurrentUser(): Promise<UserSummary> {
  const session = await requireUser();
  const db = await getDb();
  const [p] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, session.userId))
    .limit(1);

  // Valid session but the profile is gone → clear the cookie and re-login
  // (/logout clears it; redirecting straight to /login would loop via proxy).
  if (!p) redirect("/logout");

  const lp = levelProgress(p.xp);
  return {
    name: p.fullName.split(" ")[0],
    rank: lp.rank,
    level: lp.level,
    xp: p.xp,
    // A streak that hasn't been kept up (no activity today or yesterday) is 0,
    // matching how it's shown on the dashboard, profile and leaderboard.
    currentStreak: effectiveStreak(p.currentStreak, p.lastActivityAt),
  };
}
