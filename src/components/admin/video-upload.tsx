"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  CheckCircle2,
  Trash2,
  AlertCircle,
  Loader2,
  TriangleAlert,
  Copy,
  Check,
} from "lucide-react";
import { useLeaveGuard } from "@/lib/use-leave-guard";
import { cn } from "@/lib/utils";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-matroska";
/** Give up on the metadata probe rather than stall the upload behind it. */
const PROBE_TIMEOUT_MS = 20_000;

/**
 * Above this bitrate the file is plainly a raw export (OBS writes 8-20 Mbit/s)
 * rather than something a student can stream. A properly encoded 1080p lesson
 * lands around 2.5-3.5 Mbit/s, so the threshold sits just above that and does
 * not nag about files that are already fine.
 */
const HIGH_BITRATE_MBPS = 4;
/** Bitrate the ffmpeg recipe below typically produces, used for the estimate. */
const TARGET_BITRATE_MBPS = 3;
/** Fallback when the length could not be measured: judge on plain size alone. */
const LARGE_FILE_BYTES = 600 * 1024 ** 2;

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function fmtDuration(sec: number): string {
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  if (min === 0) return `${rest} сек`;
  return rest === 0 ? `${min} мин` : `${min} мин ${rest} сек`;
}

interface HeavyFileWarning {
  headline: string;
  impact: string;
  /** Size the compressed file usually comes out at; null when length is unknown. */
  estimate: string | null;
  command: string;
}

/**
 * Warns the owner when the file he picked is a raw recording rather than a
 * lesson a student can watch on a phone. Nothing here blocks the upload — the
 * point is that he sees the cost, and a ready-to-paste fix, before the bytes
 * leave his machine. Transcoding happens on his laptop, not on the VPS.
 *
 * Returns null when the file is already reasonable, or when there is nothing
 * useful to say (short clip, unknown length and modest size).
 */
function buildHeavyFileWarning(file: File, durationSec: number | null): HeavyFileWarning | null {
  // Keep the original name so the command can be pasted as-is.
  const base = file.name.replace(/\.[^.]+$/, "") || "video";
  const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
  const command =
    `ffmpeg -i ${quote("./" + file.name)} -vf "scale='min(1920,iw)':-2" ` +
    `-c:v libx264 -preset slow -crf 23 -c:a aac -b:a 128k ` +
    `-movflags +faststart ${quote("./" + base + "-web.mp4")}`;

  if (durationSec === null) {
    if (file.size < LARGE_FILE_BYTES) return null;
    return {
      headline: `Файл весит ${fmtSize(file.size)} — для одного урока это очень много.`,
      impact:
        "Студент с телефона скачает весь этот объём: видео будет часто останавливаться " +
        "на подгрузку и съест заметную часть мобильного трафика.",
      estimate: null,
      command,
    };
  }

  const mbps = (file.size * 8) / durationSec / 1e6;
  if (mbps < HIGH_BITRATE_MBPS) return null;

  return {
    headline:
      `Файл весит ${fmtSize(file.size)} при длительности ${fmtDuration(durationSec)} — ` +
      `это ${mbps.toFixed(1)} Мбит/с.`,
    impact:
      `Чтобы смотреть без пауз, у студента должен быть стабильный интернет около ` +
      `${Math.ceil(mbps)} Мбит/с — на мобильном такое бывает не всегда. И весь урок — ` +
      `это ${fmtSize(file.size)} его трафика.`,
    estimate: fmtSize((durationSec * TARGET_BITRATE_MBPS * 1e6) / 8),
    command,
  };
}

/** The ffmpeg line, copyable in one tap — it is far too long to retype. */
function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-line bg-ink-2/60 p-2">
      <code className="block overflow-x-auto font-mono text-[11px] leading-relaxed whitespace-pre text-muted">
        {command}
      </code>
      <button
        type="button"
        onClick={async () => {
          if (resetTimer.current) clearTimeout(resetTimer.current);
          try {
            await navigator.clipboard.writeText(command);
            setFailed(false);
            setCopied(true);
          } catch {
            // Clipboard API is unavailable over plain http — say so instead of
            // looking like a dead button; the text above stays selectable.
            setCopied(false);
            setFailed(true);
          }
          resetTimer.current = setTimeout(() => {
            setCopied(false);
            setFailed(false);
          }, 4000);
        }}
        className={cn(
          "mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold transition-colors",
          copied ? "text-teal" : failed ? "text-muted" : "text-gold hover:text-gold-soft",
        )}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Скопировано" : failed ? "Скопируйте вручную" : "Скопировать команду"}
      </button>
    </div>
  );
}

/**
 * Reads the clip's length out of the file itself, so the owner never has to type
 * it in by hand (the player and the watch-percentage both depend on it).
 *
 * Screen recordings (MediaRecorder) carry no duration in their header and the
 * browser reports `Infinity` for them — seeking past the end forces it to scan
 * the file and emit a `durationchange` with the real value. Resolves `null` when
 * the length cannot be measured; the upload goes ahead either way.
 */
function readDurationSec(file: File, signal: AbortSignal): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    let settled = false;

    const finish = (sec: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      v.removeAttribute("src");
      v.load(); // aborts a still-running scan before the blob URL goes away
      URL.revokeObjectURL(url);
      resolve(sec !== null && sec > 0 ? Math.round(sec) : null);
    };

    const abort = () => finish(null);
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { finish(null); return; }

    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) {
        finish(v.duration);
        return;
      }
      try {
        v.currentTime = 1e101; // clamped to the end, which reveals the duration
      } catch {
        finish(null); // not seekable — nothing more to try
      }
    };
    v.ondurationchange = () => {
      if (Number.isFinite(v.duration)) finish(v.duration);
    };
    v.onerror = () => finish(null);

    v.preload = "metadata";
    v.muted = true;
    v.src = url;
  });
}

/**
 * Uploads straight to the lesson's Route Handler with XHR — `fetch` gives no
 * upload-progress events, and a 500 MB upload with no progress bar looks frozen.
 */
export function VideoUpload({
  lessonId,
  hasVideo,
  sizeBytes,
}: {
  lessonId: number;
  hasVideo: boolean;
  sizeBytes: number | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<HeavyFileWarning | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  const request = useRef<XMLHttpRequest | null>(null);
  const probeController = useRef<AbortController | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const mounted = useRef(true);
  const lock = useRef(false);
  useLeaveGuard(busy, "Загрузка или удаление видео ещё не завершены.");
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; probeController.current?.abort(); request.current?.abort(); };
  }, []);
  function stop() {
    probeController.current?.abort(); request.current?.abort();
    lock.current = false; setBusy(false); setProgress(null); setError("Загрузка отменена. Можно повторить.");
  }

  async function upload(file: File) {
    if (lock.current) return;
    lock.current = true;
    setRetryFile(file);
    const controller = new AbortController();
    probeController.current = controller;
    setArmed(false);
    setError(null);
    setWarning(null);
    setDone(false);
    setProgress(0);
    setBusy(true);

    // Probe before sending: the request body is the raw file stream, so the
    // measured length has to travel as a header.
    const durationSec = await readDurationSec(file, controller.signal);
    if (!mounted.current || controller.signal.aborted) return;

    // Same measurements also tell us whether this is a raw export. Shown before
    // the first byte goes out, but deliberately not a blocker: the owner may
    // have a good reason, and a stuck upload button is worse than a heavy file.
    setWarning(buildHeavyFileWarning(file, durationSec));

    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.timeout = 1800000;
    const settle = () => { request.current = null; lock.current = false; if (mounted.current) { setBusy(false); setProgress(null); } };
    xhr.open("POST", `/api/admin/lessons/${lessonId}/video`);
    const ext = file.name.split(".").pop()?.toLowerCase();
    const mime = ({ mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska" } as Record<string, string>)[ext || ""];
    xhr.setRequestHeader("Content-Type", file.type || mime || "application/octet-stream");
    if (durationSec) xhr.setRequestHeader("X-Video-Duration", String(durationSec));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      settle();
      if (!mounted.current) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        setRetryFile(null);
        setDone(true);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } else {
        let msg = "Не удалось загрузить видео";
        try {
          msg = JSON.parse(xhr.responseText)?.error ?? msg;
        } catch {
          /* non-JSON error body */
        }
        setError(msg);
      }
    };
    xhr.onerror = () => { settle(); if (mounted.current) setError("Обрыв соединения. Повторите загрузку."); };
    xhr.ontimeout = () => { settle(); if (mounted.current) setError("Загрузка заняла больше 30 минут. Проверьте соединение и повторите."); };
    xhr.onabort = () => { settle(); if (mounted.current) setError("Загрузка отменена."); };

    xhr.send(file);
  }

  async function removeVideo() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}/video`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDone(false);
      setArmed(false);
      router.refresh();
    } catch {
      setError("Не удалось удалить видео");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-raised/50 p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:bg-raised-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
          {hasVideo ? "Заменить видео" : "Загрузить видео"}
        </button>

        {hasVideo && !busy && (
          <span className="inline-flex items-center gap-1.5 text-xs text-teal">
            <CheckCircle2 className="size-3.5" />
            Видео загружено{sizeBytes ? ` · ${fmtSize(sizeBytes)}` : ""}
          </span>
        )}
        {done && !hasVideo && (
          <span className="inline-flex items-center gap-1.5 text-xs text-teal">
            <CheckCircle2 className="size-3.5" />
            Готово
          </span>
        )}

        {hasVideo && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setArmed(true)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-danger disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            Удалить
          </button>
        )}
      </div>

      {armed && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span>Удалить видео из этого урока?</span><button type="button" disabled={busy} className="btn-secondary text-danger" onClick={() => void removeVideo()}>Подтвердить удаление</button><button type="button" disabled={busy} className="btn-secondary" onClick={() => setArmed(false)}>Отмена</button></div>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {progress !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">{progress === 100 ? "Сохраняем видео…" : "Загрузка…"}</span>
            <button type="button" onClick={stop} className="min-h-11 px-2 underline">Отменить</button>
            <span className="nums font-medium text-text">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-gold to-gold-soft transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error} {retryFile && !busy && <button type="button" className="min-h-11 underline" onClick={() => void upload(retryFile)}>Повторить</button>}</span>
        </p>
      )}

      {warning && (
        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5 text-xs">
          <p className="flex items-start gap-2 font-semibold text-gold">
            <TriangleAlert className="mt-px size-3.5 shrink-0" />
            <span>{warning.headline}</span>
          </p>
          <p className="mt-1.5 text-muted">{warning.impact}</p>
          <p className="mt-1.5 text-muted">
            Для более быстрой загрузки можно сжать файл на компьютере{" "}
            {warning.estimate
              ? `— картинка почти не изменится, а вес упадёт примерно до ${warning.estimate}.`
              : "— картинка почти не изменится, а вес упадёт в несколько раз."}{" "}
            Установите{" "}
            <a
              href="https://ffmpeg.org/download.html"
              target="_blank"
              rel="noreferrer"
              className="text-gold underline underline-offset-2"
            >
              ffmpeg
            </a>{" "}
            и выполните в терминале, в папке с видео:
          </p>
          <CopyCommand command={warning.command} />
          <p className="mt-1.5 text-faint">
            Часть <span className="font-mono">-movflags +faststart</span> обязательна: без неё
            плеер не сможет начать показ, пока не скачает почти весь файл.
          </p>
        </div>
      )}

      <p className="mt-2.5 text-xs text-faint">
        MP4, WebM, MOV или MKV. Файл хранится на платформе и доступен только тем, у кого
        есть доступ к уроку.
      </p>
    </div>
  );
}
