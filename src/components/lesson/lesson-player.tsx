"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, Trophy, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveProgress, completeLesson, type CompleteResult } from "@/app/(app)/lesson/actions";
import { VideoPlayer } from "./video-player";

const THRESHOLD = 80;
/** Real playback needed before an unmeasurable video opens the gate. */
const UNMEASURED_GRACE_SEC = 5;

export function LessonPlayer({
  lessonId,
  videoUrl,
  initialWatchedPct,
  initialCompleted,
  nextLessonId,
  resumeAt = 0,
  durationHint = 0,
  canSkipGate = false,
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
  /** Staff previewing their own course — never gate them on watch time. */
  canSkipGate?: boolean;
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
  const [unmeasurable, setUnmeasurable] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);

  const hasVideo = Boolean(videoUrl);
  // Completion opens when already done, there's no video, the video is broken,
  // its length is unmeasurable, the student is staff previewing, the video
  // played through to its end, or the accumulated watch threshold is met.
  //
  // Reaching the end counts on purpose: watch-time accounting undershoots for
  // honest viewers (a re-watch, a buffering hiccup, playing in a background
  // tab), and a student who is looking at the last frame has finished the
  // lesson by any reasonable reading. `watchedPct` is still recorded from real
  // playback only, so the progress bar keeps telling the truth.
  const canComplete =
    completed ||
    !hasVideo ||
    videoError ||
    canSkipGate ||
    unmeasurable ||
    reachedEnd ||
    watchedPct >= THRESHOLD;

  // The file's own length wins; `durationHint` covers screen recordings, whose
  // header has none. 0 = the watch percentage cannot be computed at all.
  const durationOf = (v: HTMLVideoElement) =>
    Number.isFinite(v.duration) && v.duration > 0 ? v.duration : durationHint;

  const persist = useCallback(
    (pct: number, force = false) => {
      const rounded = Math.round(pct);
      if (rounded <= savedPctRef.current) return;
      // Persist in ~5% steps (or when forced, e.g. on unmount / end) — each
      // saveProgress re-checks access server-side, so saving every 1% would
      // hammer the DB through the last fifth of every video.
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
      // Neither the file nor the lesson knows how long the video is, so there
      // is no percentage to gate on — open the button after a few seconds of
      // real playback instead of locking the student in the lesson forever.
      if (watchedSecRef.current >= UNMEASURED_GRACE_SEC) setUnmeasurable(true);
      return;
    }
    const pct = Math.min(100, (watchedSecRef.current / total) * 100);
    watchedPctRef.current = Math.max(watchedPctRef.current, pct);
    setWatchedPct((prev) => (pct > prev ? pct : prev));
    if (pct >= THRESHOLD) persist(pct);
  };

  // Persist the LATEST progress on unmount (via ref — a stale closure over
  // `watchedPct` would save the initial value). Force-saves even sub-5% deltas,
  // so leaving before the 80% gate still restores where you were.
  useEffect(() => {
    return () => persist(watchedPctRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            // otherwise a lesson resumed past 20% could never reach 80% this
            // session even if watched to the very end. Anti-skip is preserved:
            // forward seeks still add nothing. Re-runs when the player recovers
            // a missing duration, which is when the baseline first computes.
            const total = durationOf(v);
            if (total > 0) {
              // A length turned up after all (the probe recovered it) → the
              // percentage is meaningful again, so re-arm the watch gate.
              setUnmeasurable(false);
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
            // Reaching the end opens the button regardless of that figure; see
            // the note on `canComplete`.
            setReachedEnd(true);
          }}
          onError={() => setVideoError(true)}
        />
      ) : null}

      {videoError && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Не удалось загрузить видео. Обновите страницу или попробуйте позже.
        </p>
      )}

      {/* progress requirement — meaningless without a length, so hide it then */}
      {hasVideo && !completed && !unmeasurable && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted">
              Просмотрено · нужно {THRESHOLD}% для завершения
            </span>
            <span className="nums font-medium text-text">{Math.round(watchedPct)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                watchedPct >= THRESHOLD ? "bg-teal" : "bg-gradient-to-r from-gold to-gold-soft",
              )}
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
            disabled={!canComplete || pending}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors",
              canComplete
                ? "bg-gold text-gold-ink shadow-glow hover:bg-gold-soft"
                : "cursor-not-allowed border border-line-strong bg-raised text-faint",
            )}
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

        {/* Only offer the next lesson once this one is done — the next lesson is
            sequentially locked until then, so clicking it hit a wall. */}
        {nextLessonId && completed && (
          <button
            type="button"
            onClick={() => router.push(`/lesson/${nextLessonId}`)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
          >
            Следующий урок
            <ArrowRight className="size-4" />
          </button>
        )}

        {/* Last lesson done → the course is finished (sequential unlock guarantees
            every earlier lesson is complete). Give it a real ending. */}
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

      {!canComplete && hasVideo && (
        <p className="text-xs text-faint">
          Кнопка активируется после просмотра {THRESHOLD}% видео — или когда
          досмотрите его до конца.
        </p>
      )}
    </div>
  );
}
