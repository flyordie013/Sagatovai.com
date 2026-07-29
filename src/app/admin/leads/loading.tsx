/** Fallback for the site leads list. */
export default function AdminLeadsLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем лиды"
      className="mx-auto max-w-[900px] animate-pulse space-y-6"
    >
      <header className="space-y-2.5">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-8 w-56 rounded-xl bg-white/5" />
        <div className="h-4 w-80 max-w-full rounded bg-white/5" />
      </header>

      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-white/5" />
                <div className="h-4 w-32 rounded bg-white/5" />
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="h-6 w-24 rounded-full bg-white/5" />
                <div className="h-7 w-48 rounded-lg bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
