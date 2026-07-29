/**
 * Streamed fallback for the dashboard — mirrors Hero + StatsStrip + the
 * course grid with its sidebar so the layout doesn't jump when data lands.
 */
export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем кабинет"
      className="mx-auto max-w-[1480px] animate-pulse space-y-6"
    >
      {/* hero */}
      <section className="space-y-3">
        <div className="h-3 w-28 rounded-lg bg-white/5" />
        <div className="h-9 w-[min(100%,22rem)] rounded-xl bg-white/5" />
        <div className="h-4 w-[min(100%,30rem)] rounded-lg bg-white/5" />
      </section>

      {/* stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 ring-inset-hair"
          >
            <div className="size-10 shrink-0 rounded-xl bg-white/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-5 w-16 rounded-lg bg-white/5" />
              <div className="h-3 w-24 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        {/* course grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair"
            >
              <div className="mb-4 size-12 rounded-xl bg-white/5" />
              <div className="h-5 w-3/4 rounded-lg bg-white/5" />
              <div className="mt-2 h-4 w-full rounded bg-white/5" />
              <div className="mt-4 flex gap-4">
                <div className="h-3 w-20 rounded bg-white/5" />
                <div className="h-3 w-16 rounded bg-white/5" />
              </div>
              <div className="mt-5 h-1.5 w-full rounded-full bg-white/5" />
              <div className="mt-5 h-11 w-full rounded-xl bg-white/5" />
            </div>
          ))}
        </div>

        {/* sidebar cards */}
        <aside className="space-y-4">
          {[132, 176, 148].map((h) => (
            <div
              key={h}
              className="rounded-2xl border border-line bg-surface ring-inset-hair"
              style={{ height: h }}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
