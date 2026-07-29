"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { submitLead, type LeadState } from "./actions";

const inputBase =
  "w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      {pending ? "Отправляем…" : "Оставить заявку"}
    </button>
  );
}

export function LeadForm({
  courseId,
  courseTitle,
}: {
  courseId?: number;
  courseTitle?: string;
}) {
  const [state, action] = useActionState<LeadState, FormData>(submitLead, {});

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-teal/30 bg-teal/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 size-8 text-teal" />
        <p className="font-display text-lg font-bold">Заявка отправлена</p>
        <p className="mt-1 text-sm text-muted">
          Свяжемся с вами в ближайшее время и расскажем, как начать.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      {courseId ? <input type="hidden" name="courseId" value={courseId} /> : null}

      <div>
        <label htmlFor="lead-name" className="mb-1.5 block text-xs font-medium text-muted">
          Как вас зовут
        </label>
        <input id="lead-name" name="name" required maxLength={120} placeholder="Данияр" className={inputBase} />
      </div>

      <div>
        <label htmlFor="lead-contact" className="mb-1.5 block text-xs font-medium text-muted">
          Телефон, WhatsApp или email
        </label>
        <input
          id="lead-contact"
          name="contact"
          required
          maxLength={120}
          placeholder="+7 700 000 00 00"
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="lead-comment" className="mb-1.5 block text-xs font-medium text-muted">
          Комментарий <span className="text-faint">— необязательно</span>
        </label>
        <textarea
          id="lead-comment"
          name="comment"
          maxLength={1000}
          rows={3}
          placeholder={
            courseTitle ? `Интересует курс «${courseTitle}»` : "Что хотите изучить?"
          }
          className={`${inputBase} resize-y leading-relaxed`}
        />
      </div>

      {state.error && (
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {state.error}
        </p>
      )}

      <SubmitBtn />
      <p className="text-center text-xs text-faint">
        Нажимая кнопку, вы соглашаетесь на{" "}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-muted"
        >
          обработку персональных данных
        </a>
        .
      </p>
    </form>
  );
}
