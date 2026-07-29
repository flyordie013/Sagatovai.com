/** Fallback for gamification: redemptions, missions, achievements, rewards. */
export default function AdminGamificationLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем геймификацию"
      className="mx-auto max-w-[900px] animate-pulse space-y-8"
    >
      <header className="space-y-2.5">
        <div className="h-3 w-24 rounded bg-white/5" />
        <div className="h-8 w-64 rounded-xl bg-white/5" />
        <div className="h-4 w-full max-w-md rounded bg-white/5" />
      </header>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="mt-2 h-4 w-3/4 rounded bg-white/5" />
      </div>

      {/* four content sections, each: title + a couple of rows + a form */}
      {[0, 1, 2, 3].map((s) => (
        <section key={s} className="space-y-3">
          <div className="h-5 w-52 rounded-lg bg-white/5" />
          {[0, 1].map((r) => (
            <div
              key={r}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-48 max-w-full rounded bg-white/5" />
                <div className="h-3 w-64 max-w-full rounded bg-white/5" />
              </div>
              <div className="h-9 w-24 shrink-0 rounded-xl bg-white/5" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
