"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Last-resort boundary. Without it an unhandled server error renders Next's
 * bare English crash screen with no way back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
          <AlertTriangle className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="font-display text-2xl font-extrabold">Что-то пошло не так</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Ошибка на нашей стороне. Попробуйте обновить — если повторится, напишите нам.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-faint">код: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
        >
          <RotateCw className="size-4" />
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
