"use client";

import { Menu, Flame } from "lucide-react";
import type { UserSummary } from "@/types";
import { formatNumber } from "@/lib/utils";

export function Topbar({
  user,
  onMenu,
}: {
  user: UserSummary;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/80 px-4 py-3 backdrop-blur-md sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Открыть меню"
        className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-raised text-text transition-colors hover:bg-raised-2 lg:hidden"
      >
        <Menu className="size-5" strokeWidth={2} />
      </button>

      <div className="mr-auto flex min-w-0 flex-col">
        <p className="truncate text-[15px] font-semibold tracking-tight sm:text-lg">
          {user.name}
        </p>
        <p className="hidden truncate text-xs text-muted sm:block">
          Ваше обучение в OQU
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="hidden items-center gap-2 rounded-xl border border-line-strong bg-raised px-3 py-2 font-mono text-xs sm:flex">
          <span className="text-muted">Ур.</span>
          <span className="font-semibold">{user.level}</span>
          <span className="text-line-strong">·</span>
          <span className="nums text-gold">{formatNumber(user.xp)} XP</span>
        </div>

        <div
          className="flex items-center gap-1.5 rounded-xl border border-line bg-raised px-3 py-2 font-mono text-xs"
          title="Серия дней подряд"
        >
          <Flame className="size-4 text-gold" />
          <span className="nums">{user.currentStreak}</span>
        </div>
      </div>
    </header>
  );
}
