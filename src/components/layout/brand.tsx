import { cn } from "@/lib/utils";

/** OQU wordmark + geometric nomad mark. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised shadow-glow ring-inset-hair">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
            stroke="#f5a524"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3" fill="#f5a524" />
        </svg>
      </div>
      {!compact && (
        <span className="min-w-0 font-display text-xl font-extrabold leading-none tracking-[0.08em]">
          OQU
        </span>
      )}
    </div>
  );
}

/** Small inline mark, e.g. for compact contexts. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("size-5", className)}
      aria-hidden="true"
    >
      <path
        d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}
