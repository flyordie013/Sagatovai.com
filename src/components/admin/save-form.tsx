"use client";

import { useRef, useState, type ReactNode } from "react";
import { useLeaveGuard } from "@/lib/use-leave-guard";

/** Retain entered values on failed saves, and warn before leaving dirty forms. */
export function SaveForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>; children: ReactNode; className?: string;
}) {
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const revision = useRef(0);
  useLeaveGuard(dirty, "Есть несохранённые изменения.");
  return <form className={className} onReset={event => event.preventDefault()} onChange={() => { revision.current++; setDirty(true); setStatus(""); }}
    action={async (data) => {
      const submitted = revision.current;
      setStatus("Сохраняем…");
      try {
        await action(data);
        const changed = revision.current !== submitted;
        setDirty(changed); setStatus(changed ? "Сохранено. Новые изменения ещё не сохранены." : "Изменения сохранены");
      }
      catch (error) {
        if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
        setStatus("Не удалось сохранить. Проверьте соединение и повторите.");
      }
    }}>
    {children}
    <p role="status" className="col-span-full text-sm text-muted">{status || (dirty ? "Есть несохранённые изменения" : "")}</p>
  </form>;
}
