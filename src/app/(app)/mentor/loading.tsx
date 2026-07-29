/** Fallback for the mentor chat: header, thread chips, message area. */
export default function MentorLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем наставника"
      className="mx-auto max-w-3xl animate-pulse space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-xl bg-white/5" />
          <div className="h-4 w-24 rounded bg-white/5" />
        </div>
        <div className="h-10 w-32 shrink-0 rounded-xl bg-white/5" />
      </header>

      <div className="flex flex-wrap gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-7 w-32 rounded-full bg-white/5" />
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair">
        <div className="h-12 w-3/5 rounded-2xl bg-white/5" />
        <div className="ml-auto h-10 w-1/2 rounded-2xl bg-white/5" />
        <div className="h-16 w-4/5 rounded-2xl bg-white/5" />
        <div className="h-12 w-full rounded-xl bg-white/5" />
      </div>
    </div>
  );
}
