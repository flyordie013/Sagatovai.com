/** Fallback for the course editor: settings card + module/lesson cards. */
export default function AdminCourseDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем курс"
      className="mx-auto max-w-[900px] animate-pulse space-y-6"
    >
      <div className="h-4 w-40 rounded bg-white/5" />

      {/* header + settings */}
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair sm:p-6">
        <div className="space-y-2">
          <div className="h-8 w-64 max-w-full rounded-xl bg-white/5" />
          <div className="h-3 w-72 max-w-full rounded bg-white/5" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-10 w-full rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </div>

      {/* modules */}
      {[0, 1].map((m) => (
        <div
          key={m}
          className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
        >
          <div className="h-5 w-56 max-w-full rounded-lg bg-white/5" />
          <div className="mt-4 space-y-2.5">
            {[0, 1, 2].map((l) => (
              <div
                key={l}
                className="flex items-center gap-3 rounded-xl border border-line bg-raised p-3"
              >
                <div className="size-8 shrink-0 rounded-lg bg-white/5" />
                <div className="h-4 flex-1 rounded bg-white/5" />
                <div className="h-4 w-16 shrink-0 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
