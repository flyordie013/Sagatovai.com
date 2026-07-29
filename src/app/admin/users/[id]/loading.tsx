/** Fallback for a student card: profile header, stat tiles, access blocks. */
export default function AdminUserDetailLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем пользователя"
      className="mx-auto max-w-[900px] animate-pulse space-y-6"
    >
      <div className="h-4 w-44 rounded bg-white/5" />

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair sm:p-6">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-full bg-white/5" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="h-7 w-56 max-w-full rounded-xl bg-white/5" />
            <div className="h-4 w-48 max-w-full rounded bg-white/5" />
          </div>
        </div>
      </div>

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

      {[0, 1].map((i) => (
        <div
          key={i}
          className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair"
        >
          <div className="h-5 w-48 rounded-lg bg-white/5" />
          <div className="h-4 w-full rounded bg-white/5" />
          <div className="h-10 w-full rounded-xl bg-white/5" />
        </div>
      ))}
    </div>
  );
}
