/**
 * Fallback for the admin overview (and any admin route without its own
 * loading.tsx): section header, the 3×3 stat grid, quick links.
 */
export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем панель"
      className="mx-auto max-w-[1200px] animate-pulse space-y-8"
    >
      <header className="space-y-2.5">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-8 w-72 max-w-full rounded-xl bg-white/5" />
        <div className="h-4 w-96 max-w-full rounded bg-white/5" />
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
          >
            <div className="size-10 rounded-xl bg-white/5" />
            <div className="mt-3 h-6 w-20 rounded-lg bg-white/5" />
            <div className="mt-2 h-4 w-24 rounded bg-white/5" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
          >
            <div className="size-12 shrink-0 rounded-xl bg-white/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-white/5" />
              <div className="h-3 w-full rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
