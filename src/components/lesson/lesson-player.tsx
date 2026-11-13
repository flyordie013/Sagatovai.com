"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { completeLesson } from "@/app/(app)/lesson/actions";
import { VideoPlayer } from "./video-player";

export function LessonPlayer({ lessonId, videoUrl, initialWatchedPct, initialCompleted, resumeAt = 0, durationHint = 0 }: {
  lessonId: number; videoUrl: string | null; initialWatchedPct: number; initialCompleted: boolean;
  resumeAt?: number; durationHint?: number; nextLessonId?: number | null; courseSlug?: string;
}) {
  const router = useRouter();
  const state = useRef({ position: resumeAt, pct: initialWatchedPct, lastTime: resumeAt, watched: 0, sentAt: 0, ready: !videoUrl });
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [retryPosition, setRetryPosition] = useState(resumeAt);

  const persist = useCallback((beacon = false) => {
    if (!state.current.ready) return;
    const payload = JSON.stringify({ position: state.current.position, pct: state.current.pct, capturedAt: Date.now() });
    const url = `/api/lessons/${lessonId}/progress`;
    state.current.sentAt = Date.now();
    if (beacon && navigator.sendBeacon?.(url, new Blob([payload], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true })
      .then((r) => setSaveError(!r.ok)).catch(() => setSaveError(true));
  }, [lessonId]);

  useEffect(() => {
    if (!videoUrl) persist();
    const flush = () => persist(true);
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    const online = () => persist();
    window.addEventListener("pagehide", flush);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      flush(); window.removeEventListener("pagehide", flush); window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [persist, videoUrl]);

  async function finish() {
    setPending(true); setError(""); persist();
    try {
      const result = await completeLesson(lessonId);
      if (!result.ok) setError(result.error || "Не удалось сохранить отметку.");
      else { setCompleted(true); router.refresh(); }
    } catch { setError("Не удалось сохранить отметку. Попробуйте ещё раз."); }
    finally { setPending(false); }
  }

  return <div className="space-y-4">
    {videoUrl ? <VideoPlayer key={attempt} src={videoUrl} initialTime={retryPosition} durationHint={durationHint}
      onLoadedMetadata={(v) => {
        state.current.lastTime = v.currentTime; state.current.ready = true;
        const duration = Number.isFinite(v.duration) ? v.duration : durationHint;
        state.current.watched = Math.max(state.current.watched, initialWatchedPct / 100 * duration);
      }}
      onTick={(v) => {
        const s = state.current, delta = v.currentTime - s.lastTime;
        s.lastTime = v.currentTime; s.position = v.currentTime;
        if (!v.seeking && delta > 0 && delta < 1.5) s.watched += delta;
        const duration = Number.isFinite(v.duration) ? v.duration : durationHint;
        if (duration > 0) s.pct = Math.max(s.pct, Math.min(100, s.watched / duration * 100));
        if (Date.now() - s.sentAt >= 10000) persist();
      }} onPaused={(v) => { state.current.position = v.currentTime; persist(); }}
      onEnded={() => persist()} onError={() => setVideoError(true)} /> :
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-muted">В этом уроке можно работать с текстом и материалами ниже.</div>}
    {videoError && <div role="alert" className="rounded-xl border border-danger/30 p-4 text-sm">
      <p>Видео не загрузилось. Проверьте соединение и попробуйте ещё раз.</p>
      <button className="btn-secondary mt-3" onClick={() => { setRetryPosition(state.current.position); setVideoError(false); setAttempt((v) => v + 1); }}><RotateCcw className="size-4" /> Повторить загрузку</button>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
      <p className="max-w-md text-sm text-muted">Смотрите в своём темпе. Отметка о завершении — для вашего удобства.</p>
      {completed ? <span className="inline-flex items-center gap-2 text-sm text-teal"><CheckCircle2 className="size-4" /> Урок завершён</span> :
        <button className="btn-secondary" onClick={finish} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Отметить завершённым</button>}
    </div>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {saveError && <p role="status" className="text-sm text-muted">Позиция пока не сохранена. <button className="text-gold underline" onClick={() => persist()}>Повторить</button></p>}
  </div>;
}
