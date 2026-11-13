"use client";

import { useActionState } from "react";
import { ArrowRight, AlertCircle, MailCheck } from "lucide-react";
import { requestReset, type ForgotState } from "./actions";

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

export function ForgotForm() {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, {});

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/10 p-5 text-center">
        <MailCheck className="mx-auto mb-2 size-8 text-teal" />
        <p className="font-display font-bold">Проверьте почту</p>
        <p className="mt-1 text-sm text-muted">
          Если аккаунт с таким email существует, мы отправили ссылку для сброса пароля. Она
          действует 1 час.
        </p>
      </div>
    );
  }

  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Электронная почта</span>
        <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" className={inputClass} />
      </label>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          <span>{state.error} <a href="/contacts" className="underline">Связаться с поддержкой</a></span>
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить ссылку"}
        {!pending && <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}
