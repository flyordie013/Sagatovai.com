"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Check } from "lucide-react";
import { createPurchaseRequest } from "./actions";

export function RequestButton({
  courseId,
  whatsapp,
  alreadyRequested,
}: {
  courseId: number;
  whatsapp: string;
  alreadyRequested: boolean;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      {done ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-teal">
          <Check className="size-4" />
          Заявка отправлена — менеджер свяжется с тобой
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await createPurchaseRequest(courseId);
              if (r.ok) setDone(true);
              else setError(r.error ?? "Не удалось отправить заявку");
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:opacity-60"
        >
          {pending ? "Отправка…" : "Оставить заявку"}
        </button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
      >
        <MessageCircle className="size-3.5" />
        Или написать в WhatsApp
      </a>
    </div>
  );
}
