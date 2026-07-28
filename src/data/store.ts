import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, storeItems, redemptions } from "@/db/schema";

export interface StoreItem {
  id: number;
  code: string;
  name: string;
  description: string;
  category: string;
  xpRequired: number;
  icon: string;
  /** Download/open link for digital rewards (null until the owner attaches one). */
  payloadUrl: string | null;
  unlocked: boolean;
  claimed: boolean;
}

export interface StoreData {
  xp: number;
  items: StoreItem[];
}

/** Store catalog for a user: reward items UNLOCKED by accumulated XP (no spend). */
export async function getStore(userId: string): Promise<StoreData> {
  const db = await getDb();

  const [profile] = await db
    .select({ xp: profiles.xp })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  const xp = profile?.xp ?? 0;

  const items = await db
    .select()
    .from(storeItems)
    .where(eq(storeItems.isActive, true))
    .orderBy(asc(storeItems.xpRequired));

  // A cancelled redemption must not count as claimed — otherwise the item stays
  // "Получено" and (for digital rewards) keeps the download link live after the
  // owner rescinded it.
  const claimedRows = await db
    .select({ itemId: redemptions.itemId })
    .from(redemptions)
    .where(and(eq(redemptions.userId, userId), ne(redemptions.status, "cancelled")));
  const claimedSet = new Set(claimedRows.map((r) => r.itemId));

  return {
    xp,
    items: items.map((it) => ({
      id: it.id,
      code: it.code,
      name: it.name,
      description: it.description,
      category: it.category,
      xpRequired: it.xpRequired,
      icon: it.icon,
      // Only reveal the link to someone who has actually claimed it.
      payloadUrl: claimedSet.has(it.id) ? it.payloadUrl : null,
      unlocked: xp >= it.xpRequired,
      claimed: claimedSet.has(it.id),
    })),
  };
}
