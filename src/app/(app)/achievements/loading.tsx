/** Fallback for achievements: progress ring header + badge grid. */
export default function AchievementsLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем достижения"
      className="mx-auto max-w-[1480px] animate-pulse space-y-6"
    >
      <header className="flex items-center gap-4">
        <div className="size-[72px] shrink-0 rounded-full bg-white/5" />
        <div className="space-y-2">
          <div className="h-8 w-52 rounded-xl bg-white/5" />
          <div className="h-4 w-32 rounded bg-white/5" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="size-12 shrink-0 rounded-xl bg-white/5" />
              <div className="h-6 w-24 rounded-full bg-white/5" />
            </div>
            <div className="mt-4 h-5 w-2/3 rounded-lg bg-white/5" />
            <div className="mt-2 h-4 w-full rounded bg-white/5" />
            <div className="mt-auto space-y-1.5 pt-4">
              <div className="h-1.5 w-full rounded-full bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
