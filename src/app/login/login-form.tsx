"use client";

import Link from "next/link";
import { PasswordInput } from "@/components/ui/password-input";
import { useActionState, useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initial);

  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Электронная почта</span>
        <input
          name="email"
          value={values.email ?? ""}
          onChange={(e) => setValues(v => ({ ...v, email: e.target.value }))}
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted">Пароль</span>
          <Link
            href="/forgot-password"
            className="text-xs text-muted underline-offset-2 transition-colors hover:text-gold"
          >
            Забыли пароль?
          </Link>
        </div>
        <PasswordInput
          aria-label="Пароль"
          name="password"
          value={values.password ?? ""}
          onChange={(e) => setValues(v => ({ ...v, password: e.target.value }))}
          type="password"
          autoComplete="current-password"
          required
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
        {pending ? "Вход…" : "Войти"}
        {!pending && <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}
