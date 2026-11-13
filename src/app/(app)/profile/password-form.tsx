"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { changePassword, type PasswordState } from "./actions";

const initial: PasswordState = {};

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2";

export function PasswordForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(async (prev: PasswordState, data: FormData) => {
    const result = await changePassword(prev, data);
    if (result.success) setValues({});
    return result;
  }, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Текущий пароль</span>
        <PasswordInput
          name="current"
          value={values.current ?? ""}
          onChange={(e) => setValues(v => ({ ...v, current: e.target.value }))}
          aria-label="Текущий пароль"
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
          <PasswordInput
            name="next"
          value={values.next ?? ""}
          onChange={(e) => setValues(v => ({ ...v, next: e.target.value }))}
          aria-label="Новый пароль"
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
          <PasswordInput
            name="confirm"
          value={values.confirm ?? ""}
          onChange={(e) => setValues(v => ({ ...v, confirm: e.target.value }))}
          aria-label="Подтверждение"
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
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      {state.success && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2.5 text-sm text-teal">
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
