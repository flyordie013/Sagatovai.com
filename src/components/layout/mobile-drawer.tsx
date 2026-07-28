"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MobileDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
      // Keeps the ~9 nav controls out of the tab order while the drawer is
      // closed; aria-hidden alone doesn't remove them from focus.
      inert={!open}
    >
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="Закрыть меню"
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-default bg-ink-2/70 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Навигация"
        className={cn(
          "absolute inset-y-0 left-0 w-[82%] max-w-[300px] border-r border-line bg-ink shadow-pop transition-transform duration-300 ease-[var(--ease-soft)]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть меню"
          className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg border border-line bg-raised text-muted transition-colors hover:text-text"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
