import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/data/user";
import { getSession, isStaff } from "@/lib/session";

// Reads live data (Postgres) — render on demand, never prerender at build.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const session = await getSession();
  return (
    <AppShell user={user} isStaff={isStaff(session?.role)}>
      {children}
    </AppShell>
  );
}
