"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">
        {label}
        {hint ? <span className="ml-2 font-normal text-faint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(inputBase, "min-h-24 resize-y leading-relaxed", className)} {...props} />
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(inputBase, "cursor-pointer appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...props
}: { label: string } & ComponentProps<"input">) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
      <input
        type="checkbox"
        className={cn("size-4 accent-[var(--color-gold)]", className)}
        {...props}
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  className,
  pendingLabel = "Сохранение…",
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/**
 * Two-step confirm for destructive server-action forms.
 *
 * The idle trigger is `type="button"`, so a stray click can never submit — it
 * only arms the control. Confirming renders a real `type="submit"` button that
 * still lives inside the parent <form>, so the form's hidden inputs post to the
 * same server action untouched.
 */
export function ConfirmSubmit({
  children,
  triggerClassName,
  confirmLabel = "Удалить",
  pendingLabel = "Удаление…",
  prompt = "Точно?",
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  triggerClassName?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  prompt?: string;
  "aria-label"?: string;
}) {
  const [armed, setArmed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasArmed = useRef(false);

  // Cancelling returns focus to the trigger so keyboard users don't get dropped
  // to <body> when the confirm row unmounts.
  useEffect(() => {
    if (!armed && wasArmed.current) triggerRef.current?.focus();
    wasArmed.current = armed;
  }, [armed]);

  if (!armed) {
    return (
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onClick={() => setArmed(true)}
        className={triggerClassName}
      >
        {children}
      </button>
    );
  }

  return (
    <span role="group" aria-live="polite" className="inline-flex items-center gap-2">
      <span className="text-xs text-muted">{prompt}</span>
      <ConfirmActions
        confirmLabel={confirmLabel}
        pendingLabel={pendingLabel}
        onCancel={() => setArmed(false)}
      />
    </span>
  );
}

/** Split out so `useFormStatus` reports the parent form's pending state. */
function ConfirmActions({
  confirmLabel,
  pendingLabel,
  onCancel,
}: {
  confirmLabel: string;
  pendingLabel: string;
  onCancel: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        autoFocus
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger transition-colors hover:bg-danger/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? pendingLabel : confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-lg px-2.5 py-1 text-xs text-muted transition-colors hover:text-text disabled:opacity-60"
      >
        Отмена
      </button>
    </>
  );
}
