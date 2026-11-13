"use client";

import { PasswordInput } from "@/components/ui/password-input";
import { useActionState, useState } from "react";
import { ArrowRight, AlertCircle } from "lucide-react";
import { register, type RegisterState } from "./actions";
import { MIN_PASSWORD } from "@/lib/auth-rules";

const initial: RegisterState = {};

const inputClass =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(register, initial);

  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Как вас зовут</span>
        <input
          name="fullName"
          value={values.fullName ?? ""}
          onChange={(e) => setValues(v => ({ ...v, fullName: e.target.value }))}
          type="text"
          autoComplete="name"
          required
          maxLength={120}
          placeholder="Ваше имя"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Электронная почта</span>
        <input
          name="email"
          value={values.email ?? ""}
          onChange={(e) => setValues(v => ({ ...v, email: e.target.value }))}
          type="email"
          autoComplete="email"
          required
          maxLength={200}
          placeholder="you@example.com"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">
          Пароль <span className="text-faint">— минимум {MIN_PASSWORD} символов</span>
        </span>
        <PasswordInput
          name="password"
          aria-label="Пароль"
          value={values.password ?? ""}
          onChange={(e) => setValues(v => ({ ...v, password: e.target.value }))}
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
          aria-label="Повторите пароль"
          value={values.confirm ?? ""}
          onChange={(e) => setValues(v => ({ ...v, confirm: e.target.value }))}
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
        {pending ? "Создаём…" : "Создать аккаунт"}
        {!pending && <ArrowRight className="size-4" />}
      </button>
    </form>
  );
}
