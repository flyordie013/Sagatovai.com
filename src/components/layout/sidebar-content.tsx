"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Shield, Loader2 } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { logout } from "@/app/login/actions";
import { Brand } from "./brand";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Pending spinner for the nav item currently being navigated to. Uses
 * `useLinkStatus` (client-only) — this is the safe alternative to a segment
 * `loading.tsx`, which broke under force-dynamic + PGlite.
 */
function NavIndicator({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  if (pending) return <Loader2 className="ml-auto size-3.5 shrink-0 animate-spin text-gold" />;
  if (active)
    return (
      <span className="ml-auto size-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--color-gold)]" />
    );
  return null;
}

export function SidebarContent({
  onNavigate,
  isStaff = false,
}: {
  onNavigate?: () => void;
  isStaff?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col gap-7 p-4">
      <div className="px-2 pt-2">
        <Brand />
      </div>

      <nav className="flex flex-col gap-1" aria-label="Основная навигация">
        <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Меню
        </p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-gold/25 bg-gold/10 text-text"
                  : "text-muted hover:bg-white/5 hover:text-text",
              )}
            >
              <Icon
                className={cn(
                  "size-[19px] shrink-0 transition-colors",
                  active ? "text-gold" : "text-muted group-hover:text-text",
                )}
                strokeWidth={1.9}
              />
              <span>{item.label}</span>
              <NavIndicator active={active} />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-1 border-t border-line pt-3">
        {isStaff && (
          <Link
            href="/admin"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
          >
            <Shield className="size-[18px]" strokeWidth={1.9} />
            <span>Админ-панель</span>
          </Link>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="size-[18px]" strokeWidth={1.9} />
            <span>Выйти</span>
          </button>
        </form>
      </div>
    </div>
  );
}
