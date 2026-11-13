"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, FileText, Loader2, Upload, X } from "lucide-react";
import type { LessonMaterial } from "@/data/materials";
import { useLeaveGuard } from "@/lib/use-leave-guard";
import { MATERIAL_ACCEPT, formatFileSize } from "@/lib/material-policy";

type UploadItem = { id: string; file: File; replace?: string; progress: number; status: "queued" | "uploading" | "done" | "error"; error?: string };
export function MaterialManager({ lessonId, lessonTitle, courseTitle }: { lessonId: number; lessonTitle: string; courseTitle: string }) {
  const root = useRef<HTMLDivElement>(null);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const [files, setFiles] = useState<LessonMaterial[]>([]);
  const [limit, setLimit] = useState(0);
  const [maxCount, setMaxCount] = useState(30);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  useLeaveGuard(busy, "Загрузка или сохранение файлов ещё не завершены.");
  const endpoint = `/api/admin/lessons/${lessonId}/materials`;
  const load = useCallback(async () => {
    const r = await fetch(endpoint, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Не удалось загрузить список.");
    if (!mounted.current) return;
    setFiles(data.materials); setLimit(data.maxBytes); setMaxCount(data.maxCount);
  }, [endpoint]);
  useEffect(() => {
    mounted.current = true;
    const details = root.current?.closest("details");
    let loaded = false;
    const init = () => { if ((!details || details.open) && !loaded) { loaded = true; void load().catch((e) => { loaded = false; setError(e.message); }); } };
    init(); details?.addEventListener("toggle", init);
    return () => { mounted.current = false; details?.removeEventListener("toggle", init); xhr.current?.abort(); };
  }, [load]);
  function update(id: string, values: Partial<UploadItem>) { setQueue((q) => q.map((i) => i.id === id ? { ...i, ...values } : i)); }
  async function upload(items: UploadItem[]) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(""); setMessage("");
    for (const item of items) {
      if (!mounted.current) break;
      if (item.file.size > limit || item.file.size === 0) { update(item.id, { status: "error", error: `Выберите непустой файл до ${formatFileSize(limit)}.` }); continue; }
      update(item.id, { status: "uploading", progress: 0, error: undefined });
      try {
        await new Promise<void>((resolve, reject) => {
          const req = new XMLHttpRequest(); xhr.current = req;
          req.open("POST", endpoint + (item.replace ? `?replace=${item.replace}` : ""));
          req.setRequestHeader("Content-Type", "application/octet-stream");
          req.setRequestHeader("X-File-Name", encodeURIComponent(item.file.name));
          req.setRequestHeader("X-Upload-Id", item.id);
          req.timeout = 1800000;
          req.upload.onprogress = (e) => { if (e.lengthComputable) update(item.id, { progress: Math.round(e.loaded / e.total * 100) }); };
          req.onload = () => { if (req.status >= 200 && req.status < 300) resolve(); else { let reason = "Не удалось загрузить файл."; try { reason = JSON.parse(req.responseText).error || reason; } catch {} reject(new Error(reason)); } };
          req.onerror = () => reject(new Error("Нет соединения. Повторите загрузку."));
          req.ontimeout = () => reject(new Error("Загрузка заняла слишком много времени. Попробуйте ещё раз."));
          req.onabort = () => reject(new Error("Загрузка отменена."));
          req.send(item.file);
        });
        update(item.id, { status: "done", progress: 100 });
        await load();
      } catch (e) { update(item.id, { status: "error", error: e instanceof Error ? e.message : "Ошибка загрузки." }); }
    }
    xhr.current = null; lock.current = false; if (mounted.current) setBusy(false);
  }
  function choose(selected: FileList | File[] | null, replace?: string) {
    if (!selected || busy || !limit) return;
    const incoming = Array.from(selected);
    if (!replace && incoming.length + files.length > maxCount) { setError(`В уроке может быть не больше ${maxCount} файлов.`); return; }
    const items: UploadItem[] = incoming.map((file) => ({ id: crypto.randomUUID(), file, replace, progress: 0, status: "queued" }));
    setQueue((q) => [...q.filter((i) => i.status !== "done"), ...items]); void upload(items);
  }
  async function mutate(method: string, body: object) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      await load(); setMessage("Изменения сохранены."); setArmed(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Не удалось сохранить изменения."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  return <div ref={root} className="my-5 space-y-4 border-y border-line py-5">
    <div><h4 className="font-semibold">Файлы для скачивания</h4><p className="mt-1 text-xs text-muted break-words">{courseTitle} → {lessonTitle}. Только для учеников с доступом к этому курсу.</p></div>
    <label className={`block rounded-xl border border-dashed border-line-strong p-5 text-center ${busy ? "opacity-60" : "cursor-pointer hover:border-gold"}`}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); choose(e.dataTransfer.files); }}>
      <Upload className="mx-auto mb-2 size-5 text-gold" /><span className="block text-sm font-semibold">Выбрать файлы или перетащить сюда</span>
      <span className="mt-2 block text-xs text-muted">PDF, DOCX, XLSX, PPTX, TXT, CSV, JSON, ZIP, JPG, PNG, WebP. {limit ? `До ${formatFileSize(limit)} на файл, максимум ${maxCount}.` : "Загружаем ограничения…"}</span>
      <input type="file" multiple accept={MATERIAL_ACCEPT} disabled={busy || !limit} className="mt-3 block w-full text-xs" aria-label={`Добавить файлы к уроку ${lessonTitle}`} onChange={(e) => { choose(e.target.files); e.target.value = ""; }} />
    </label>
    {queue.map((item) => <div key={item.id} className="rounded-lg bg-surface p-3 text-sm" role="status">
      <div className="flex items-start justify-between gap-2"><span className="min-w-0 break-all">{item.file.name}</span><span className="shrink-0 text-xs text-muted">{item.status === "done" ? "Загружен" : item.status === "uploading" ? `${item.progress}%` : item.status === "queued" ? "В очереди" : "Не загружен"}</span></div>
      {item.status === "uploading" && <div className="mt-2 flex items-center gap-2"><progress aria-label={`Загрузка ${item.file.name}`} value={item.progress} max={100} className="w-full accent-gold" /><button type="button" className="p-2" aria-label="Отменить загрузку" onClick={() => xhr.current?.abort()}><X className="size-4" /></button></div>}
      {item.error && <p className="mt-2 text-xs text-danger">{item.error} <button type="button" disabled={busy} className="underline" onClick={() => void upload([item])}>Повторить</button></p>}
    </div>)}
    {files.map((file, index) => <div key={file.id} className="rounded-xl border border-line p-3">
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const data = new FormData(e.currentTarget); void mutate("PATCH", { id: file.id, title: data.get("title") }); }}>
        <input name="title" aria-label={`Название материала ${file.filename}`} defaultValue={file.title} required maxLength={180} className="min-w-0 flex-1 basis-full rounded-lg border border-line-strong bg-ink px-3 py-2 text-sm sm:basis-auto" />
        <button className="btn-secondary" disabled={busy}>Сохранить</button>
      </form>
      <p className="mt-2 flex items-start gap-2 text-xs text-muted"><FileText className="size-4 shrink-0" /><span className="break-all">{file.filename} · {formatFileSize(file.sizeBytes)}</span></p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-icon" disabled={busy || index === 0} aria-label={`Переместить ${file.title} выше`} onClick={() => void mutate("PATCH", { id: file.id, direction: "up" })}><ArrowUp className="size-4" /></button>
        <button type="button" className="btn-icon" disabled={busy || index === files.length - 1} aria-label={`Переместить ${file.title} ниже`} onClick={() => void mutate("PATCH", { id: file.id, direction: "down" })}><ArrowDown className="size-4" /></button>
        <label className="btn-secondary cursor-pointer">Заменить<input type="file" accept={MATERIAL_ACCEPT} disabled={busy} className="sr-only" aria-label={`Заменить ${file.filename}`} onChange={(e) => { choose(e.target.files, file.id); e.target.value = ""; }} /></label>
        {armed === file.id ? <span className="flex flex-wrap items-center gap-2 text-xs"><span>Удалить этот файл?</span><button type="button" disabled={busy} className="btn-secondary text-danger" onClick={() => void mutate("DELETE", { id: file.id })}>Удалить</button><button type="button" className="btn-secondary" onClick={() => setArmed(null)}>Отмена</button></span> : <button type="button" disabled={busy} className="btn-secondary text-danger" onClick={() => setArmed(file.id)}>Удалить</button>}
      </div>
    </div>)}
    {!files.length && limit > 0 && <p className="text-sm text-muted">Файлов пока нет. Добавленные материалы появятся под видео.</p>}
    {busy && <p role="status" className="flex items-center gap-2 text-xs text-muted"><Loader2 className="size-3 animate-spin" /> Выполняем…</p>}
    {error && <p role="alert" className="text-sm text-danger">{error} <button type="button" className="underline" onClick={() => { setError(""); void load().catch((e) => setError(e.message)); }}>Обновить список</button></p>}
    {message && <p role="status" className="text-sm text-teal">{message}</p>}
  </div>;
}
