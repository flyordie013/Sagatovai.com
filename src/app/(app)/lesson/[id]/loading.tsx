/** Fallback for a lesson: breadcrumb, title, player and materials. */
export default function LessonLoading() {
  return (
    <div
      role="status"
      aria-label="Загружаем урок"
      className="mx-auto max-w-3xl animate-pulse space-y-5"
    >
      <div className="h-4 w-40 rounded bg-white/5" />

      <div className="space-y-2.5">
        <div className="h-3 w-52 rounded bg-white/5" />
        <div className="h-8 w-3/4 rounded-xl bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
      </div>

      {/* video player */}
      <div className="aspect-video w-full rounded-2xl border border-line bg-surface ring-inset-hair" />

      {/* lesson materials */}
      <div className="space-y-2.5 rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair">
        <div className="h-3 w-36 rounded bg-white/5" />
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="h-4 w-5/6 rounded bg-white/5" />
      </div>

    </div>
  );
}
