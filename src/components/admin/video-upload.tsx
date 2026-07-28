"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, CheckCircle2, Trash2, AlertCircle, Loader2 } from "lucide-react";

const ACCEPT = "video/mp4,video/webm,video/quicktime,video/x-matroska";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
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
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function upload(file: File) {
    setError(null);
    setDone(false);
    setProgress(0);
    setBusy(true);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/lessons/${lessonId}/video`);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
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
    xhr.onerror = () => {
      setBusy(false);
      setProgress(null);
      setError("Обрыв соединения при загрузке");
    };

    xhr.send(file);
  }

  async function removeVideo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}/video`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDone(false);
      router.refresh();
    } catch {
      setError("Не удалось удалить видео");
    } finally {
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
            onClick={removeVideo}
            className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-danger disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            Удалить
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />

      {progress !== null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">Загрузка…</span>
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
          {error}
        </p>
      )}

      <p className="mt-2.5 text-xs text-faint">
        MP4, WebM, MOV или MKV. Файл хранится на платформе и доступен только тем, у кого
        есть доступ к уроку.
      </p>
    </div>
  );
}
