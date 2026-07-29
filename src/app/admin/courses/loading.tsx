/** Fallback for the admin course list + «Новый курс» form below it. */
export default function AdminCoursesLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем курсы"
      className="mx-auto max-w-[1100px] animate-pulse space-y-10"
    >
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-xl bg-white/5" />
          <div className="h-4 w-56 rounded bg-white/5" />
        </div>

        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair"
            >
              <div className="size-11 shrink-0 rounded-xl bg-white/5" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-52 max-w-full rounded bg-white/5" />
                <div className="h-3 w-72 max-w-full rounded bg-white/5" />
              </div>
              <div className="size-5 shrink-0 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="h-5 w-40 rounded-lg bg-white/5" />
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-24 rounded bg-white/5" />
                <div className="h-10 w-full rounded-xl bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
