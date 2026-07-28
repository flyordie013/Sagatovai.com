import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "gold" | "teal" | "neutral" | "danger";

const VARIANTS: Record<BadgeVariant, string> = {
  gold: "bg-gold/10 text-gold border-gold/30",
  teal: "bg-teal/10 text-teal border-teal/30",
  neutral: "bg-white/5 text-muted border-line-strong",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function Badge({
  variant = "neutral",
  className,
  children,
}: {
  variant?: BadgeVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
