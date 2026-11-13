"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Retain entered values on failed saves, and warn before leaving dirty forms. */
export function SaveForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>; children: ReactNode; className?: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a[href]");
      if (link && link.getAttribute("target") !== "_blank" && !link.getAttribute("href")?.startsWith("#") &&
        !window.confirm("Есть несохранённые изменения. Уйти со страницы?")) {
        e.preventDefault(); e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
  return <form className={className} onReset={event => event.preventDefault()} onChange={() => { setDirty(true); setStatus(""); }}
    action={async (data) => {
      setStatus("Сохраняем…");
      try { await action(data); setDirty(false); setStatus("Изменения сохранены"); }
      catch (error) {
        if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
        setStatus("Не удалось сохранить. Проверьте соединение и повторите.");
      }
    }}>
    {children}
    <p role="status" className="col-span-full text-sm text-muted">{status || (dirty ? "Есть несохранённые изменения" : "")}</p>
  </form>;
}
