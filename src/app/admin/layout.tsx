import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { requireStaff } from "@/lib/session";

// Admin reads live data (Postgres) — never prerender at build.
export const dynamic = "force-dynamic";

export const metadata = { title: "Админ-панель" };

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireStaff();
  const db = await getDb();
  const [me] = await db
    .select({ name: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.id, session.userId))
    .limit(1);

  return <AdminShell ownerName={me?.name ?? "Админ"}>{children}</AdminShell>;
}
