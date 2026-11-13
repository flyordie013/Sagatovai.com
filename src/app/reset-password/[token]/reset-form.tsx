"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { useActionState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { resetPassword, type ResetState } from "../../forgot-password/actions";
import { MIN_PASSWORD } from "@/lib/auth-rules";

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

export function ResetForm({ token }: { token: string }) {
  const boundAction = resetPassword.bind(null, token);
  const [state, action, pending] = useActionState<ResetState, FormData>(boundAction, {});

  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">
          Новый пароль <span className="text-faint">— минимум {MIN_PASSWORD} символов</span>
        </span>
        <PasswordInput
          name="password"
          aria-label="Новый пароль"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          placeholder="••••••••"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Повторите пароль</span>
        <PasswordInput
          name="confirm"
          aria-label="Подтверждение"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          placeholder="••••••••"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Сохраняем…" : "Сохранить пароль"}
        {!pending && <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}
