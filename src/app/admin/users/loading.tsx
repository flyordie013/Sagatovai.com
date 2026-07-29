/** Fallback for the user list: search, «Создать пользователя», the rows. */
export default function AdminUsersLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем пользователей"
      className="mx-auto max-w-[1100px] animate-pulse space-y-4"
    >
      <header className="space-y-2">
        <div className="h-8 w-60 rounded-xl bg-white/5" />
        <div className="h-4 w-44 rounded bg-white/5" />
      </header>

      <div className="flex gap-2">
        <div className="h-11 flex-1 rounded-xl bg-white/5" />
        <div className="h-11 w-24 shrink-0 rounded-xl bg-white/5" />
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair">
        <div className="h-5 w-56 rounded-lg bg-white/5" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-10 w-full rounded-xl bg-white/5" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair"
          >
            <div className="size-11 shrink-0 rounded-full bg-white/5" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-44 max-w-full rounded bg-white/5" />
              <div className="h-3 w-56 max-w-full rounded bg-white/5" />
            </div>
            <div className="hidden h-8 w-56 shrink-0 rounded bg-white/5 sm:block" />
            <div className="size-5 shrink-0 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
