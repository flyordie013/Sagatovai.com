/** Fallback for the profile: avatar header, stat tiles, course list. */
export default function ProfileLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем профиль"
      className="mx-auto max-w-[1100px] animate-pulse space-y-6"
    >
      {/* header */}
      <div className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-6 shadow-card ring-inset-hair sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="size-24 shrink-0 self-center rounded-full bg-white/5 sm:self-auto" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-8 w-56 max-w-full rounded-xl bg-white/5" />
            <div className="h-4 w-48 rounded bg-white/5" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-40 rounded bg-white/5" />
              <div className="h-1.5 w-full rounded-full bg-white/5" />
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
          >
            <div className="size-10 rounded-xl bg-white/5" />
            <div className="mt-3 h-6 w-16 rounded-lg bg-white/5" />
            <div className="mt-2 h-4 w-24 rounded bg-white/5" />
          </div>
        ))}
      </div>

      {/* courses */}
      <section className="space-y-4">
        <div className="h-6 w-36 rounded-lg bg-white/5" />
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 ring-inset-hair"
            >
              <div className="size-11 shrink-0 rounded-xl bg-white/5" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="h-4 w-1/2 rounded bg-white/5" />
                <div className="h-1.5 w-full rounded-full bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
