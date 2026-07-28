"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, storeItems, redemptions } from "@/db/schema";
import { requireUser } from "@/lib/session";

export interface ClaimResult {
  ok: boolean;
  error?: string;
}

/**
 * Unlock (claim) a store reward. XP is NOT spent — items only require reaching
 * an XP threshold. Profile and item are re-read from the DB to validate.
 */
export async function claimItem(itemId: number, note = ""): Promise<ClaimResult> {
  const { userId } = await requireUser();
  const db = await getDb();

  const [item] = await db
    .select({
      xpRequired: storeItems.xpRequired,
      isActive: storeItems.isActive,
      category: storeItems.category,
    })
    .from(storeItems)
    .where(eq(storeItems.id, itemId))
    .limit(1);
  if (!item || !item.isActive) return { ok: false, error: "Награда не найдена" };

  const [profile] = await db
    .select({ xp: profiles.xp })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!profile) return { ok: false, error: "Профиль не найден" };

  if (profile.xp < item.xpRequired)
    return { ok: false, error: "Недостаточно XP для этой награды" };

  // Physical merch needs delivery details so the owner isn't left chasing them.
  const cleanNote = note.trim().slice(0, 500);
  if (item.category === "merch" && !cleanNote) {
    return { ok: false, error: "Укажите размер и контакт для доставки" };
  }

  // Idempotent: unique (userId, itemId). No XP is deducted. A previously
  // CANCELLED claim is reactivated (→ pending) so re-claiming works; an already
  // pending/fulfilled claim is left untouched.
  await db
    .insert(redemptions)
    .values({ userId, itemId, note: cleanNote })
    .onConflictDoUpdate({
      target: [redemptions.userId, redemptions.itemId],
      set: { status: "pending", note: cleanNote },
      setWhere: eq(redemptions.status, "cancelled"),
    });

  revalidatePath("/store");
  revalidatePath("/admin/gamification");

  return { ok: true };
}
