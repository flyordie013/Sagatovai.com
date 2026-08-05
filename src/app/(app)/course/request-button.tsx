"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Check, Copy, ExternalLink } from "lucide-react";
import type { PaymentDetails } from "@/lib/payment";
import { cn, formatNumber } from "@/lib/utils";
import { createPurchaseRequest } from "./actions";

/** Payment details plus the receipt link, which is built on the server. */
export type PaymentPanel = PaymentDetails & { receiptUrl: string };

/**
 * The number, large enough to read on a phone and copyable in one tap. It stays
 * plain selectable text too, so a long-press still works where the Clipboard
 * API is unavailable (http, in-app browsers).
 */
function CopyNumber({ display, copy }: { display: string; copy: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  return (
    <button
      type="button"
      onClick={async () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
        try {
          await navigator.clipboard.writeText(copy);
          setFailed(false);
          setCopied(true);
        } catch {
          // In-app browsers (Instagram, TikTok) block the clipboard. Say so —
          // silently doing nothing reads as a broken button.
          setCopied(false);
          setFailed(true);
        }
        resetTimer.current = setTimeout(() => {
          setCopied(false);
          setFailed(false);
        }, 4000);
      }}
      className="mt-1 flex w-full flex-col gap-1 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white/5"
    >
      {/* Stacked, not side by side: a 16-digit card number plus a label does not
          fit on one line at 375px. */}
      <span className="select-all font-mono text-lg font-bold break-all text-text">
        {display}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold",
          copied ? "text-teal" : failed ? "text-muted" : "text-gold",
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied
          ? "Скопировано"
          : failed
            ? "Скопируйте номер вручную"
            : "Нажмите, чтобы скопировать"}
      </span>
    </button>
  );
}

/**
 * What the student sees the moment the request is saved: how much, where to
 * send it, and how to prove they sent it. Without this the purchase stalls
 * until the owner happens to be online.
 */
function NextStep({ price, payment }: { price: number; payment: PaymentPanel }) {
  return (
    <div className="w-full space-y-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 text-left">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
        <Check className="size-4" />
        Заявка принята
      </p>

      <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-sm text-muted">К оплате</span>
        <span className="nums font-display text-2xl font-extrabold text-gold">
          {formatNumber(price)} ₸
        </span>
      </div>

      {payment.numberDisplay && (
        <div className="rounded-xl border border-line-strong bg-raised p-3">
          <p className="text-xs text-muted">Номер для перевода в Kaspi</p>
          <CopyNumber display={payment.numberDisplay} copy={payment.numberCopy} />
          {payment.recipient && (
            <p className="mt-1 text-xs text-muted">
              Получатель: <span className="font-medium text-text">{payment.recipient}</span>
            </p>
          )}
        </div>
      )}

      {payment.link && (
        <a
          href={payment.link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
        >
          <ExternalLink className="size-4" />
          Открыть Kaspi
        </a>
      )}

      {payment.note && <p className="text-xs text-muted">{payment.note}</p>}

      <a
        href={payment.receiptUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
      >
        <MessageCircle className="size-4" />
        Отправить чек в WhatsApp
      </a>

      <p className="text-xs text-faint">
        Доступ к курсу откроется после того, как мы подтвердим оплату.
      </p>
    </div>
  );
}

export function RequestButton({
  courseId,
  whatsapp,
  alreadyRequested,
  price,
  payment,
}: {
  courseId: number;
  whatsapp: string;
  alreadyRequested: boolean;
  /** Course price in ₸ — the amount shown on the next-step screen. */
  price: number;
  /** null when the owner hasn't configured where to pay: no invented details. */
  payment: PaymentPanel | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // `alreadyRequested` reflects the open request in the DB, so returning to the
  // course page later lands straight on the payment screen, not on the button.
  const [done, setDone] = useState(alreadyRequested);
  const [error, setError] = useState<string | null>(null);

  const showPanel = done && payment !== null;

  // The copy AROUND this button is server-rendered from the same request, so it
  // needs a refresh to catch up. Deliberately outside the transition above: the
  // payment details must appear the instant the request is saved, not after a
  // round trip on a phone connection.
  useEffect(() => {
    if (done && !alreadyRequested) router.refresh();
  }, [done, alreadyRequested, router]);

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      {done ? (
        payment ? (
          <NextStep price={price} payment={payment} />
        ) : (
          <p className="inline-flex items-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-2.5 text-sm text-teal">
            <Check className="size-4" />
            Заявка отправлена — менеджер свяжется с вами
          </p>
        )
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              // Idempotent server-side: a repeat click reports the existing
              // request back instead of inserting a second row.
              const r = await createPurchaseRequest(courseId);
              if (r.ok) setDone(true);
              else setError(r.error ?? "Не удалось отправить заявку");
            })
          }
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:opacity-60"
        >
          {pending ? "Отправка…" : "Оставить заявку"}
        </button>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
      {/* The panel already leads to the same WhatsApp chat — don't offer it twice. */}
      {!showPanel && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-text"
        >
          <MessageCircle className="size-3.5" />
          Или написать в WhatsApp
        </a>
      )}
    </div>
  );
}
