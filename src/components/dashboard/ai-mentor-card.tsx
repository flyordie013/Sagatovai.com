import Link from "next/link";
import { Bot, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AiMentorCard() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-raised to-surface p-5">
      <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-gold/10 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid size-11 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold shadow-glow">
          <Bot className="size-6" strokeWidth={1.8} />
        </div>
        <div>
          <p className="font-display font-bold">AI-Наставник</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-teal">
            <span className="size-1.5 rounded-full bg-teal shadow-[0_0_6px_var(--color-teal)]" />
            online
          </p>
        </div>
      </div>
      <p className="relative mt-4 text-sm text-muted">
        Спросите меня о чём угодно — разберём ошибку в коде или доведём проект до
        конца.
      </p>
      <Link
        href="/mentor"
        className="relative mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
      >
        Спросите меня о чём угодно
        <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
