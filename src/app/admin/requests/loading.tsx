/** Fallback for course access requests: header, the how-it-works note, cards. */
export default function AdminRequestsLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем запросы"
      className="mx-auto max-w-[900px] animate-pulse space-y-4"
    >
      <header className="space-y-2.5">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-8 w-80 max-w-full rounded-xl bg-white/5" />
        <div className="h-4 w-full max-w-lg rounded bg-white/5" />
      </header>

      <div className="rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="mt-2 h-4 w-4/5 rounded bg-white/5" />
      </div>

      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-4 w-52 max-w-full rounded bg-white/5" />
              <div className="h-3 w-64 max-w-full rounded bg-white/5" />
            </div>
            <div className="h-6 w-28 rounded-full bg-white/5" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((f) => (
              <div key={f} className="h-10 rounded-xl bg-white/5" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
