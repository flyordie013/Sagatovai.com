"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Trophy, Sparkles, Loader2 } from "lucide-react";
import { saveProgress, completeLesson, type CompleteResult } from "@/app/(app)/lesson/actions";
import { VideoPlayer } from "./video-player";

export function LessonPlayer({
  lessonId,
  videoUrl,
  initialWatchedPct,
  initialCompleted,
  nextLessonId,
  resumeAt = 0,
  durationHint = 0,
  courseSlug,
}: {
  lessonId: number;
  videoUrl: string | null;
  initialWatchedPct: number;
  initialCompleted: boolean;
  nextLessonId: number | null;
  /** Seconds to resume playback from. */
  resumeAt?: number;
  /** Lesson length from the DB, used when the file itself carries none. */
  durationHint?: number;
  /** Course slug — used to link back when the last lesson is finished. */
  courseSlug?: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const watchedSecRef = useRef(0);
  const lastTimeRef = useRef(0);
  const savedPctRef = useRef(initialWatchedPct);
  // Always holds the latest watched % — the unmount cleanup closes over the
  // FIRST render's state, so reading `watchedPct` there would save the stale
  // initial value and lose all sub-threshold progress.
  const watchedPctRef = useRef(initialWatchedPct);

  const [watchedPct, setWatchedPct] = useState(initialWatchedPct);
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  const hasVideo = Boolean(videoUrl);

  // The file's own length wins; `durationHint` covers screen recordings, whose
  // header has none. 0 = the watch percentage cannot be computed at all.
  const durationOf = (v: HTMLVideoElement) =>
    Number.isFinite(v.duration) && v.duration > 0 ? v.duration : durationHint;

  const persist = useCallback(
    (pct: number, force = false) => {
      const rounded = Math.round(pct);
      if (rounded <= savedPctRef.current) return;
      // Persist in ~5% steps (or when forced, e.g. on hide / unmount / end) —
      // each saveProgress re-checks access server-side, so saving every 1%
      // would hammer the DB throughout every video.
      if (!force && rounded < 100 && rounded < savedPctRef.current + 5) return;
      savedPctRef.current = rounded;
      void saveProgress(lessonId, rounded);
    },
    [lessonId],
  );

  // count only real playback (ignore forward seeks) → anti-skip
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const delta = v.currentTime - lastTimeRef.current;
    lastTimeRef.current = v.currentTime;
    if (!(delta > 0 && delta < 1.5)) return;
    watchedSecRef.current += delta;

    const total = durationOf(v);
    if (total <= 0) {
      return;
    }
    const pct = Math.min(100, (watchedSecRef.current / total) * 100);
    watchedPctRef.current = Math.max(watchedPctRef.current, pct);
    setWatchedPct((prev) => (pct > prev ? pct : prev));
    // Persist from the very first percent, not only past the gate: a phone that
    // is locked or killed mid-lesson must still resume where it stopped. The
    // ~5% step inside `persist` keeps this to ~20 writes per video.
    //
    // The stored figure doubles as the resume point, so it must never run ahead
    // of the playhead — re-watching a section accumulates more seconds than the
    // position reflects, which would otherwise resume the student past the part
    // they went back for.
    persist(Math.min(pct, (v.currentTime / total) * 100));
  };

  // Persist the LATEST progress on unmount (via ref — a stale closure over
  // `watchedPct` would save the initial value). Force-saves even sub-5% deltas,
  // so leaving early still restores where you were.
  useEffect(() => {
    return () => persist(watchedPctRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mobile browsers discard a backgrounded tab without ever running the unmount
  // cleanup above, so the progress also has to be flushed the moment the page
  // is hidden — locking the phone or switching apps must not lose the lesson.
  // `pagehide` is dispatched at the window, `visibilitychange` at the document.
  useEffect(() => {
    const flush = () => persist(watchedPctRef.current, true);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [persist]);

  async function onComplete() {
    setPending(true);
    setError(null);
    persist(watchedPct, true);
    const res = await completeLesson(lessonId);
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Не удалось завершить урок");
      return;
    }
    setCompleted(true);
    setResult(res);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {hasVideo ? (
        <VideoPlayer
          src={videoUrl!}
          initialTime={resumeAt}
          durationHint={durationHint}
          onTick={(v) => {
            videoRef.current = v;
            onTimeUpdate();
          }}
          onLoadedMetadata={(v) => {
            videoRef.current = v;
            lastTimeRef.current = v.currentTime;
            // Resume continues watch-accounting from the saved fraction —
            // otherwise resumed progress would restart from zero. Anti-skip is preserved:
            // forward seeks still add nothing. Re-runs when the player recovers
            // a missing duration, which is when the baseline first computes.
            const total = durationOf(v);
            if (total > 0) {
              watchedSecRef.current = Math.max(
                watchedSecRef.current,
                (savedPctRef.current / 100) * total,
              );
            }
          }}
          onEnded={() => {
            // Save whatever was legitimately accumulated — do NOT force 100%,
            // so the recorded progress stays an honest watch figure.
            persist(watchedPctRef.current, true);
          }}
          onError={() => setVideoError(true)}
        />
      ) : null}

      {videoError && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Не удалось загрузить видео. Обновите страницу или попробуйте позже.
        </p>
      )}

      {hasVideo && !completed && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">Просмотрено</span>
            <span className="nums font-medium text-text">{Math.round(watchedPct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width] duration-300"
              style={{ width: `${Math.min(100, watchedPct)}%` }}
            />
          </div>
        </div>
      )}

      {/* success toast */}
      {result && !result.alreadyCompleted && (
        <div className="rounded-2xl border border-teal/30 bg-teal/10 p-4">
          <p className="flex items-center gap-2 font-display font-bold text-text">
            <CheckCircle2 className="size-5 text-teal" />
            Урок завершён! <span className="text-gold">+{result.xpEarned} XP</span>
          </p>
          {result.leveledUp && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-gold">
              <Sparkles className="size-4" />
              Новый уровень {result.newLevel} — {result.newRank}!
            </p>
          )}
          {result.achievements && result.achievements.length > 0 && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-teal">
              <Trophy className="size-4" />
              Достижения: {result.achievements.join(", ")}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* actions */}
      <div className="flex flex-wrap items-center gap-3">
        {!completed ? (
          <button
            type="button"
            onClick={onComplete}
            disabled={pending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Завершить урок
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm font-semibold text-teal">
            <CheckCircle2 className="size-4" />
            Урок пройден
          </span>
        )}

        {nextLessonId && (
          <button
            type="button"
            onClick={() => router.push(`/lesson/${nextLessonId}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
          >
            Следующий урок
            <ArrowRight className="size-4" />
          </button>
        )}

        {/* On the final lesson, completion still gives a convenient route back. */}
        {!nextLessonId && completed && courseSlug && (
          <button
            type="button"
            onClick={() => router.push(`/course/${courseSlug}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-5 py-3 text-sm font-semibold text-teal transition-colors hover:bg-teal/15"
          >
            <Trophy className="size-4" />
            Курс пройден
          </button>
        )}
      </div>

    </div>
  );
}
