/** Fallback for the store: XP balance card + one category of reward cards. */
export default function StoreLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем магазин"
      className="mx-auto max-w-[1480px] animate-pulse space-y-6"
    >
      <header className="space-y-2">
        <div className="h-8 w-44 rounded-xl bg-white/5" />
        <div className="h-4 w-64 rounded bg-white/5" />
      </header>

      {/* balance */}
      <div className="rounded-2xl border border-line bg-gradient-to-br from-raised to-surface p-6 shadow-card ring-inset-hair sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="size-14 shrink-0 rounded-2xl bg-white/5" />
            <div className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-9 w-40 rounded-xl bg-white/5" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[70px] w-full rounded-2xl border border-line bg-surface ring-inset-hair sm:w-28"
              />
            ))}
          </div>
        </div>
      </div>

      {/* rewards */}
      <section className="space-y-4">
        <div className="h-5 w-32 rounded-lg bg-white/5" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="size-12 shrink-0 rounded-xl bg-white/5" />
                <div className="h-6 w-24 rounded-full bg-white/5" />
              </div>
              <div className="h-5 w-3/4 rounded-lg bg-white/5" />
              <div className="mt-2 h-4 w-full rounded bg-white/5" />
              <div className="mt-4 h-3 w-40 rounded bg-white/5" />
              <div className="mt-3 h-1.5 w-full rounded-full bg-white/5" />
              <div className="mt-5 h-11 w-full rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
