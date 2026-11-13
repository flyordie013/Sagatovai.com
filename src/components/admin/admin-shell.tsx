"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import type { AdminBadgeKey } from "@/lib/admin-nav";
import { AdminSidebarContent } from "./admin-sidebar-content";

export function AdminShell({
  ownerName,
  counts,
  children,
}: {
  ownerName: string;
  counts?: Partial<Record<AdminBadgeKey, number>>;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a className="skip-link btn-primary" href="#admin-content">Перейти к содержанию</a>
      <aside className="sticky top-0 hidden h-dvh w-full border-r border-line bg-gradient-to-b from-surface/60 to-ink/20 lg:block">
        <AdminSidebarContent counts={counts} />
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Открыть меню"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-text transition-colors hover:bg-raised-2 lg:hidden"
          >
            <Menu className="size-5" strokeWidth={2} />
          </button>
          <h1 className="mr-auto truncate text-[15px] font-extrabold tracking-tight sm:text-lg">
            Панель управления
          </h1>
          <div className="flex shrink-0 items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 py-2 text-xs">
            <span className="hidden text-muted sm:inline">Владелец:</span>
            <span className="max-w-[10rem] truncate font-semibold">{ownerName}</span>
          </div>
        </header>

        <main id="admin-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <AdminSidebarContent counts={counts} onNavigate={() => setMenuOpen(false)} />
      </MobileDrawer>
    </div>
  );
}
