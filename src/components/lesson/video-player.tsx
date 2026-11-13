"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const SKIP = 10;
/** Seek target that reveals the real end of a header-less file (see `probe`). */
const PROBE_TIME = 1e101;
/** Give up on the probe rather than leave playback parked at the end. */
const PROBE_TIMEOUT_MS = 8_000;
/** How long a lone tap waits to see whether a second one follows it. */
const DOUBLE_TAP_MS = 280;

/**
 * Safari on iPhone cannot put an arbitrary element into fullscreen — only the
 * <video> itself, through this legacy API. Typed here instead of widening the
 * global DOM lib.
 */
type FullscreenVideo = HTMLVideoElement & {
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

/**
 * How this browser can go fullscreen: `element` = the standard API on our
 * wrapper (keeps our own controls), `video` = the iOS native player, `none` =
 * not available at all, in which case the button is not rendered.
 */
type FullscreenMode = "none" | "element" | "video";

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Lesson video player with real controls: seek + buffered bar, ±10s, speed,
 * volume, PiP, fullscreen, keyboard shortcuts and resume-where-you-left-off.
 *
 * It owns the <video> element but forwards the raw events, so the caller keeps
 * its own watch-time accounting (which must ignore seeks, hence raw access).
 */
export function VideoPlayer({
  src,
  initialTime = 0,
  durationHint = 0,
  onTick,
  onEnded,
  onError,
  onLoadedMetadata,
  onPaused,
}: {
  src: string;
  initialTime?: number;
  /** Lesson length from the DB, used when the file itself carries none. */
  durationHint?: number;
  onTick?: (video: HTMLVideoElement) => void;
  onEnded?: () => void;
  onError?: () => void;
  onPaused?: (video: HTMLVideoElement) => void;
  /** Also fires again once a missing duration has been recovered. */
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumed = useRef(false);
  // Screen recordings (MediaRecorder) carry no duration in their header and the
  // browser reports `Infinity`. Seeking past the end forces it to scan the file
  // and emit a `durationchange` with the real value — same trick the uploader
  // uses. Runs at most once, before the student starts watching.
  const probe = useRef<{
    state: "idle" | "running" | "done";
    restoreTo: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ state: "idle", restoreTo: 0, timer: null });

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [full, setFull] = useState(false);
  // Resolved on the client only — the server has no way to know, and rendering
  // a button that does nothing is worse than rendering none.
  const [fsMode, setFsMode] = useState<FullscreenMode>("none");
  const [uiVisible, setUiVisible] = useState(true);
  const [started, setStarted] = useState(false);

  // Effective length: what the file reports, else the value the owner stored on
  // the lesson. 0 means "still unknown" — every readout below degrades to it.
  const total = duration > 0 ? duration : durationHint;

  const showUi = useCallback(() => {
    setUiVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // Only auto-hide while actually playing, never mid-interaction.
      if (videoRef.current && !videoRef.current.paused) setUiVisible(false);
    }, 2600);
  }, []);

  function startProbe(v: HTMLVideoElement) {
    probe.current = {
      state: "running",
      restoreTo: initialTime,
      timer: setTimeout(() => endProbe(v), PROBE_TIMEOUT_MS),
    };
    try {
      v.currentTime = PROBE_TIME; // clamped to the end, which reveals the duration
    } catch {
      endProbe(v); // not seekable — nothing more to try
    }
  }

  /** Leaves probe mode: rewinds out of the huge seek and re-announces metadata. */
  function endProbe(v: HTMLVideoElement) {
    const { state, restoreTo, timer } = probe.current;
    if (state !== "running") return;
    if (timer) clearTimeout(timer);
    probe.current = { state: "done", restoreTo: 0, timer: null };

    // Back to where the student left off (never past the very end), else start.
    const to = restoreTo > 1 && restoreTo < v.duration - 2 ? restoreTo : 0;
    try {
      v.currentTime = to;
    } catch {
      /* seek rejected — leave playback where it is */
    }
    setCurrent(v.currentTime);
    setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    onLoadedMetadata?.(v);
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    showUi();
  }, [showUi]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || total <= 0) return;
      v.currentTime = Math.min(Math.max(0, v.currentTime + delta), total);
      showUi();
    },
    [showUi, total],
  );

  const seekToRatio = useCallback(
    (ratio: number) => {
      const v = videoRef.current;
      if (!v || total <= 0) return;
      v.currentTime = Math.min(Math.max(0, ratio * total), total);
    },
    [total],
  );

  function pointerSeek(e: React.PointerEvent) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    seekToRatio((e.clientX - rect.left) / rect.width);
  }

  /**
   * iOS reports `webkitSupportsFullscreen` only once metadata has loaded, so
   * this runs again from `onLoadedMetadata` and not just on mount.
   */
  const detectFullscreen = useCallback(() => {
    if (
      document.fullscreenEnabled &&
      typeof wrapRef.current?.requestFullscreen === "function"
    ) {
      setFsMode("element");
      return;
    }
    const v: FullscreenVideo | null = videoRef.current;
    if (typeof v?.webkitEnterFullscreen === "function" && v.webkitSupportsFullscreen) {
      setFsMode("video");
      return;
    }
    setFsMode("none");
  }, []);

  async function toggleFullscreen() {
    if (fsMode === "element") {
      const el = wrapRef.current;
      if (!el) return;
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      else await el.requestFullscreen().catch(() => {});
      return;
    }
    if (fsMode === "video") {
      // iOS hands playback to the system player — our overlay is not shown
      // there, and it closes itself with the standard "Done" button.
      const v: FullscreenVideo | null = videoRef.current;
      if (!v) return;
      if (v.webkitDisplayingFullscreen) v.webkitExitFullscreen?.();
      else v.webkitEnterFullscreen?.();
    }
  }

  async function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* unsupported or blocked */
    }
  }

  useEffect(() => {
    detectFullscreen();
    const v = videoRef.current;
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    const onEnterNative = () => setFull(true);
    const onExitNative = () => setFull(false);
    document.addEventListener("fullscreenchange", onFs);
    // Fired by the iOS native player when it opens and closes.
    v?.addEventListener("webkitbeginfullscreen", onEnterNative);
    v?.addEventListener("webkitendfullscreen", onExitNative);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      v?.removeEventListener("webkitbeginfullscreen", onEnterNative);
      v?.removeEventListener("webkitendfullscreen", onExitNative);
    };
  }, [detectFullscreen]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (probe.current.timer) clearTimeout(probe.current.timer);
    };
  }, []);

  function handleMetadata(v: HTMLVideoElement) {
          setDuration(Number.isFinite(v.duration) ? v.duration : 0);
          setVolume(v.volume);
          setMuted(v.muted);
          if (!Number.isFinite(v.duration)) {
            // No length in the file — recover it before anything else, so the
            // timecode, the bar and seeking all work (resume happens after).
            // Only while paused: on a slow connection the student can hit play
            // before metadata arrives, and probing then would yank playback to
            // the end of the file. `durationHint` covers that case instead.
            if (probe.current.state === "idle" && v.paused) startProbe(v);
          } else if (!resumed.current && initialTime > 1 && initialTime < v.duration - 2) {
            // Resume where the student stopped (never past the very end).
            v.currentTime = initialTime;
          }
          resumed.current = true;
          setCurrent(v.currentTime);
          // iOS only admits it can play fullscreen once metadata is in.
          detectFullscreen();
          onLoadedMetadata?.(v);
  }

  // A cached video may emit loadedmetadata before React hydrates the page.
  // Catch up once after mount so a hard reload resumes as reliably as client navigation.
  const catchUpMetadata = useEffectEvent(() => {
    const v = videoRef.current;
    if (v && v.readyState >= 1 && !resumed.current) handleMetadata(v);
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => catchUpMetadata());
    return () => cancelAnimationFrame(frame);
  }, [src]);

  /**
   * Touch: a double tap on either half seeks ±10s (as on YouTube), a lone tap
   * toggles playback — but only once the double-tap window has passed, so the
   * first tap of a pair does not flash a pause. Mouse input stays instant.
   */
  function onVideoPointerUp(e: React.PointerEvent<HTMLVideoElement>) {
    if (e.button !== 0) return;
    if (e.pointerType !== "touch" || total <= 0) {
      togglePlay();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const forward = e.clientX - rect.left >= rect.width / 2;
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      seekBy(forward ? SKIP : -SKIP);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      togglePlay();
    }, DOUBLE_TAP_MS);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Don't hijack typing in any nested control.
    if ((e.target as HTMLElement).closest("button, input, textarea, select, a")) return;

    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        seekBy(-SKIP);
        break;
      case "ArrowRight":
        e.preventDefault();
        seekBy(SKIP);
        break;
      case "ArrowUp":
        e.preventDefault();
        applyVolume(Math.min(1, volume + 0.1));
        break;
      case "ArrowDown":
        e.preventDefault();
        applyVolume(Math.max(0, volume - 0.1));
        break;
      case "m":
      case "M":
        e.preventDefault();
        toggleMute();
        break;
      case "f":
      case "F":
        e.preventDefault();
        void toggleFullscreen();
        break;
      default:
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          seekToRatio(Number(e.key) / 10);
        }
    }
    showUi();
  }

  function applyVolume(next: number) {
    const v = videoRef.current;
    if (!v) return;
    v.volume = next;
    v.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
    showUi();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    showUi();
  }

  function applyRate(r: number) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
    setRate(r);
    showUi();
  }

  // Clamped: a hinted length can be a touch shorter than the actual file.
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const bufPct = total > 0 ? Math.min(100, (buffered / total) * 100) : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={showUi}
      onPointerLeave={() => playing && setUiVisible(false)}
      className={cn(
        "group relative select-none overflow-hidden rounded-2xl border border-line bg-black shadow-card outline-none",
        "focus-visible:ring-2 focus-visible:ring-gold/50",
        full && "rounded-none border-0",
      )}
      aria-label="Видео урока"
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        preload="metadata"
        // touch-manipulation: keeps iOS from reading the seek gesture below as
        // a double-tap-to-zoom.
        className={cn("w-full touch-manipulation bg-black object-contain", full && fsMode === "element" ? "h-full" : "aspect-video")}
        onPointerUp={onVideoPointerUp}
        onPlay={(e) => {
          // The student is watching now — never yank them back mid-playback.
          endProbe(e.currentTarget);
          setPlaying(true);
          setStarted(true);
          showUi();
        }}
        onPause={(e) => {
          setPlaying(false);
          setUiVisible(true);
          if (probe.current.state !== "running") onPaused?.(e.currentTarget);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onDurationChange={(e) => {
          const v = e.currentTarget;
          setDuration(Number.isFinite(v.duration) ? v.duration : 0);
          if (Number.isFinite(v.duration)) endProbe(v);
        }}
        onSeeked={(e) => {
          // Fallback for browsers that resolve the length without a durationchange.
          if (Number.isFinite(e.currentTarget.duration)) endProbe(e.currentTarget);
        }}
        onLoadedMetadata={(e) => handleMetadata(e.currentTarget)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          // While probing, currentTime sits at the far end of the file: don't
          // show it and don't let the caller count it as watched.
          if (probe.current.state === "running") {
            if (Number.isFinite(v.duration)) endProbe(v);
            return;
          }
          setCurrent(v.currentTime);
          if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
          }
          onTick?.(v);
        }}
        onEnded={() => {
          setPlaying(false);
          setUiVisible(true);
          onEnded?.();
        }}
        onError={() => onError?.()}
      />

      {/* buffering spinner */}
      {waiting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="size-10 animate-spin text-white/80" />
        </div>
      )}

      {/* big center play button before first start */}
      {!started && !waiting && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Воспроизвести"
          className={cn("absolute inset-x-0 top-0 grid place-items-center bg-black/30 transition-colors hover:bg-black/20", full && fsMode === "element" ? "h-full" : "aspect-video")}
        >
          <span className="grid size-20 place-items-center rounded-full bg-gold text-gold-ink shadow-glow transition-transform hover:scale-105">
            <Play className="size-9 translate-x-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {/* controls */}
      <div
        className={cn(
          "inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-1 pt-2 transition-opacity duration-200 sm:px-4 sm:pt-6",
          full ? "absolute" : "relative sm:absolute",
          uiVisible || !playing ? "opacity-100" : full ? "pointer-events-none opacity-0" : "sm:pointer-events-none sm:opacity-0",
        )}
      >
        {/* seek bar */}
        <div
          ref={barRef}
          role="slider"
          aria-label="Перемотка"
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(current)}
          aria-valuetext={`${fmt(current)} из ${fmt(total)}`}
          tabIndex={0}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            pointerSeek(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) pointerSeek(e);
          }}
          className="relative h-6 cursor-pointer touch-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white/25" style={{ width: `${bufPct}%` }} />
          </div>
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gold"
            style={{ width: `${pct}%` }}
          />
          {/* Always visible: a hover-only handle is invisible on a touchscreen. */}
          <div
            className="pointer-events-none absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow sm:size-3"
            style={{ left: `${pct}%` }}
          />
        </div>

        <div className="nums flex items-center justify-between gap-3 text-xs text-white/90" aria-live="off">
          <span className="font-mono">{fmt(current)} <span className="text-white/50">/ {fmt(total)}</span></span>
          <select aria-label="Скорость воспроизведения" value={rate} onChange={(e) => applyRate(Number(e.target.value))}
            className="h-11 w-[68px] shrink-0 rounded-lg border-0 bg-black/70 px-1 text-white focus-visible:outline-2 focus-visible:outline-gold">
            {SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-1 text-white">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Пауза" : "Играть"} className="grid size-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/15">
            {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
          </button>

          {/* Shown on phones too — most students watch there, and a video with
              no way to rewind is unusable. Slightly tighter than on desktop so
              the row still fits a 375px screen. */}
          <button type="button" onClick={() => seekBy(-SKIP)} aria-label="Назад 10 секунд" className="grid size-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/15">
            <RotateCcw className="size-[18px]" />
          </button>
          <button type="button" onClick={() => seekBy(SKIP)} aria-label="Вперёд 10 секунд" className="grid size-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/15">
            <RotateCw className="size-[18px]" />
          </button>

          <div className="group/vol flex shrink-0 items-center">
            <button type="button" onClick={toggleMute} aria-label={muted ? "Включить звук" : "Выключить звук"} className="grid size-11 place-items-center rounded-lg transition-colors hover:bg-white/15">
              {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => applyVolume(Number(e.target.value))}
              aria-label="Громкость"
              className="ml-1 hidden w-0 accent-[var(--color-gold)] transition-all group-hover/vol:w-20 group-focus-within/vol:w-20 2xl:block"
            />
          </div>

          <button type="button" onClick={togglePip} aria-label="Мини-плеер" className="hidden size-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/15 2xl:grid">
            <PictureInPicture2 className="size-[18px]" />
          </button>
          {/* Hidden where no fullscreen API exists at all, rather than offering
              a button that silently does nothing. */}
          {fsMode !== "none" && (
            <button type="button" onClick={toggleFullscreen} aria-label="На весь экран" className="grid size-11 shrink-0 place-items-center rounded-lg transition-colors hover:bg-white/15">
              {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
