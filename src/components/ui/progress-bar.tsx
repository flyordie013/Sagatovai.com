import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  className?: string;
  "aria-label"?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/5", className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width] duration-500 ease-[var(--ease-soft)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
