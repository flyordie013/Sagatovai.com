/** Fallback for the student course page: header card + module/lesson list. */
export default function CourseLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем курс"
      className="mx-auto max-w-3xl animate-pulse space-y-6"
    >
      <div className="h-4 w-28 rounded bg-white/5" />

      {/* header */}
      <div className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair sm:p-6">
        <div className="flex items-start gap-4">
          <div className="size-12 shrink-0 rounded-xl bg-white/5" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-7 w-2/3 rounded-xl bg-white/5" />
            <div className="h-4 w-full rounded bg-white/5" />
          </div>
        </div>
        <div className="mt-5 space-y-2">
          <div className="h-3 w-40 rounded bg-white/5" />
          <div className="h-1.5 w-full rounded-full bg-white/5" />
          <div className="mt-4 h-10 w-44 rounded-xl bg-white/5" />
        </div>
      </div>

      {/* modules */}
      {[0, 1].map((m) => (
        <div
          key={m}
          className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
        >
          <div className="mb-4 flex items-center gap-2">
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="h-4 w-40 rounded bg-white/5" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2].map((l) => (
              <div key={l} className="flex items-center gap-3 px-3 py-1">
                <div className="size-5 shrink-0 rounded-full bg-white/5" />
                <div className="h-4 flex-1 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
