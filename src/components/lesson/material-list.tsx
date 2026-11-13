"use client";
import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import type { LessonMaterial } from "@/data/materials";
import { formatFileSize, materialExtension } from "@/lib/material-policy";

export function MaterialList({ files }: { files: LessonMaterial[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!files.length) return null;
  async function download(file: LessonMaterial) {
    setPending(file.id); setError("");
    try {
      const url = `/api/materials/${file.id}`;
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!r.ok) throw new Error(r.status === 401 ? "Сессия закончилась. Войдите снова, чтобы скачать файл." : r.status === 403 ? "Доступ к курсу закрыт. Свяжитесь с поддержкой." : "Файл недоступен. Обновите страницу или сообщите поддержке.");
      const a = document.createElement("a"); a.href = url; a.download = file.filename; document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { setError(e instanceof Error ? e.message : "Проверьте соединение и повторите скачивание."); }
    finally { setPending(null); }
  }
  return <section aria-labelledby="lesson-materials" className="space-y-3">
    <div className="flex items-baseline gap-3"><h2 id="lesson-materials" className="text-xl font-bold">Материалы к уроку</h2><span className="text-sm text-muted">{files.length}</span></div>
    <p className="text-sm text-muted">Скачайте файлы, чтобы использовать их во время занятия.</p>
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {files.map((file) => <li key={file.id} className="flex flex-wrap items-center gap-3 p-4">
        <FileText className="size-5 shrink-0 text-gold" /><div className="min-w-0 flex-1 basis-36"><p className="break-words text-sm font-semibold">{file.title}</p><p className="mt-1 text-xs text-muted">{materialExtension(file.filename).toUpperCase()} · {formatFileSize(file.sizeBytes)}</p></div>
        <button className="btn-secondary" onClick={() => void download(file)} disabled={pending !== null} aria-label={`Скачать ${file.title}`}>{pending === file.id ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Скачать</button>
      </li>)}
    </ul>
    {error && <p role="alert" className="text-sm text-danger">{error} <a className="underline" href="/contacts">Поддержка</a></p>}
  </section>;
}
