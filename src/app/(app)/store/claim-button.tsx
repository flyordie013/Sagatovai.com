"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Loader2, Lock, Download, ExternalLink, Clock } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { claimItem } from "./actions";

export function ClaimButton({
  itemId,
  category,
  claimed,
  unlocked,
  xpShort,
  payloadUrl,
}: {
  itemId: number;
  category: string;
  claimed: boolean;
  unlocked: boolean;
  /** How much more XP is needed (only for the locked state). */
  xpShort: number;
  /** Download/open link, present only after claiming a digital reward. */
  payloadUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const isDigital = category === "guide" || category === "video";

  // ---- already claimed → actually deliver, don't just say "Получено" ----
  if (claimed) {
    if (isDigital && payloadUrl) {
      return (
        <a
          href={payloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal/15 px-4 py-3 text-sm font-semibold text-teal transition-colors hover:bg-teal/25"
        >
          {category === "video" ? <ExternalLink className="size-4" /> : <Download className="size-4" />}
          {category === "video" ? "Смотреть" : "Скачать"}
        </a>
      );
    }
    if (isDigital) {
      return (
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm font-semibold text-muted">
          <Clock className="size-4" />
          Скоро откроем доступ
        </span>
      );
    }
    // physical merch
    return (
      <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm font-semibold text-teal">
        <Check className="size-4" />
        Заявка принята
      </span>
    );
  }

  if (!unlocked) {
    return (
      <span className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm font-semibold text-muted">
        <Lock className="size-4" />
        Ещё {formatNumber(xpShort)} XP
      </span>
    );
  }

  function claim(deliveryNote = "") {
    setError(null);
    startTransition(async () => {
      const res = await claimItem(itemId, deliveryNote);
      if (res.ok) {
        setFormOpen(false);
        router.refresh();
      } else {
        setError(res.error ?? "Не удалось получить награду");
      }
    });
  }

  // ---- physical merch: capture size/contact before claiming ----
  if (!isDigital && formOpen) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) claim(note);
        }}
        className="space-y-2"
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          maxLength={500}
          placeholder="Размер и контакт для доставки"
          className="w-full rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || !note.trim()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
            Оформить
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:text-text"
          >
            Отмена
          </button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => (isDigital ? claim() : setFormOpen(true))}
        disabled={pending}
        className={cn(
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft",
          pending && "opacity-70",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
        Получить
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
