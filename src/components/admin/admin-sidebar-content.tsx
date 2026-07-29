"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Shield } from "lucide-react";
import { ADMIN_NAV, type AdminBadgeKey } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminSidebarContent({
  counts,
  onNavigate,
}: {
  counts?: Partial<Record<AdminBadgeKey, number>>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col gap-7 p-4">
      <div className="flex items-center gap-3 px-2 pt-2">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold shadow-glow ring-inset-hair">
          <Shield className="size-5" strokeWidth={2} />
        </div>
        <div className="flex min-w-0 flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-wide">Админ</span>
          <span className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-faint">
            OQU control
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Административная навигация">
        <p className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
          Управление
        </p>
        {ADMIN_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          // Unanswered leads / access requests — the owner should see them
          // without opening the screen first.
          const count = item.badge ? counts?.[item.badge] ?? 0 : 0;
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
              {count > 0 && (
                <span
                  aria-label={`${count} новых`}
                  className="nums ml-auto rounded-full border border-gold/30 bg-gold/15 px-1.5 py-0.5 text-[10px] font-bold leading-none text-gold"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
              {active && (
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-gold shadow-[0_0_8px_var(--color-gold)]",
                    count > 0 ? "ml-1.5" : "ml-auto",
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-line pt-3">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-text"
        >
          <ArrowLeft className="size-[18px]" strokeWidth={1.9} />
          <span>К платформе</span>
        </Link>
      </div>
    </div>
  );
}
