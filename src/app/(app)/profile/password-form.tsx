"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";

const initial: PasswordState = {};

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Текущий пароль</span>
        <input
          name="current"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className={inputClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Новый пароль</span>
          <input
            name="next"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Минимум 8 символов"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Подтверждение</span>
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Повторите пароль"
            className={inputClass}
          />
        </label>
      </div>

      {state.error && (
        <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      {state.success && (
        <p className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2.5 text-sm text-teal">
          <CheckCircle2 className="size-4 shrink-0" />
          {state.success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        <KeyRound className="size-4" />
        {pending ? "Сохранение…" : "Обновить пароль"}
      </button>
    </form>
  );
}
