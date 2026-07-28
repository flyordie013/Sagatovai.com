"use client";

import { useState, type ReactNode } from "react";
import type { UserSummary } from "@/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileDrawer } from "./mobile-drawer";
import { SidebarContent } from "./sidebar-content";
import { AppFooter } from "./app-footer";

export function AppShell({
  user,
  isStaff = false,
  children,
}: {
  user: UserSummary;
  isStaff?: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar isStaff={isStaff} />

      <div className="flex min-h-dvh min-w-0 flex-col">
        <Topbar user={user} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        <AppFooter />
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <SidebarContent isStaff={isStaff} onNavigate={() => setMenuOpen(false)} />
      </MobileDrawer>
    </div>
  );
}
