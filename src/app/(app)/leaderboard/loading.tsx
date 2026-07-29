/** Fallback for the leaderboard: header, 3-place podium, then the rows. */
export default function LeaderboardLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем рейтинг"
      className="mx-auto max-w-[1080px] animate-pulse space-y-6"
    >
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-xl bg-white/5" />
          <div className="h-4 w-32 rounded bg-white/5" />
        </div>
        <div className="size-12 shrink-0 rounded-2xl bg-white/5" />
      </header>

      {/* podium — silver, gold, bronze */}
      <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
            style={{ paddingTop: i === 1 ? 32 : 20 }}
          >
            <div className="h-8 w-6 rounded bg-white/5" />
            <div className={i === 1 ? "size-16 rounded-full bg-white/5" : "size-14 rounded-full bg-white/5"} />
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="h-5 w-20 rounded-lg bg-white/5" />
          </div>
        ))}
      </div>

      {/* rows */}
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 ring-inset-hair sm:gap-4 sm:p-4"
          >
            <div className="h-5 w-7 shrink-0 rounded bg-white/5 sm:w-9" />
            <div className="size-10 shrink-0 rounded-full bg-white/5 sm:size-11" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-40 max-w-full rounded bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
            <div className="hidden h-8 w-24 shrink-0 rounded bg-white/5 sm:block" />
            <div className="h-8 w-20 shrink-0 rounded bg-white/5 sm:w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
