"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Send } from "lucide-react";
import { createPurchaseRequest } from "./actions";

export function RequestButton({
  courseId,
  alreadyRequested,
}: {
  courseId: number;
  alreadyRequested: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (done && !alreadyRequested) router.refresh();
  }, [done, alreadyRequested, router]);

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      {done ? (
        <p className="inline-flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-teal">
          <Check className="size-4" />
          Заявка отправлена. Администратор проверит оплату и откроет доступ.
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try {
                const result = await createPurchaseRequest(courseId);
                if (result.ok) setDone(true);
                else setError(result.error ?? "Не удалось отправить заявку");
              } catch { setError("Не удалось отправить заявку. Проверьте соединение и повторите."); }
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:opacity-60"
        >
          <Send className="size-4" />
          {pending ? "Отправка…" : "Оставить заявку"}
        </button>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
