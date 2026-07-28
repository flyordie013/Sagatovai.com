import Link from "next/link";
import { Bot, Plus, MessageCircle } from "lucide-react";
import { requireUser, getSession, isStaff as checkStaff } from "@/lib/session";
import { getMentorData } from "@/data/mentor";
import { isMentorLive } from "@/lib/mentor-ai";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

export const metadata = { title: "AI-Наставник" };

export default async function MentorPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const { userId } = await requireUser();
  const { threads, activeThreadId, messages } = await getMentorData(userId, t);
  const live = isMentorLive();
  const isStaff = checkStaff((await getSession())?.role);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold sm:text-3xl">
            <Bot className="size-7 text-gold" strokeWidth={1.8} />
            AI-Наставник
          </h1>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-teal">
            <span className="size-1.5 rounded-full bg-teal shadow-[0_0_6px_var(--color-teal)]" />
            online 24/7
          </p>
        </div>
        <Link
          href="/mentor?t=new"
          className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
        >
          <Plus className="size-4" />
          Новый чат
        </Link>
      </header>

      {/* Students must not be shown developer .env instructions. Staff still get
          the actionable version. */}
      {!live && (
        <p className="rounded-xl border border-gold/25 bg-gold/10 px-4 py-2.5 text-xs text-gold">
          {isStaff ? (
            <>
              Демо-режим: наставник отвечает заглушкой. Добавьте{" "}
              <span className="font-mono">GROQ_API_KEY</span> (бесплатно),{" "}
              <span className="font-mono">OPENAI_API_KEY</span> или{" "}
              <span className="font-mono">ANTHROPIC_API_KEY</span> в{" "}
              <span className="font-mono">.env.local</span> — и он заработает по-настоящему.
            </>
          ) : (
            <>AI-наставник скоро заработает в полную силу — сейчас он отвечает в демо-режиме.</>
          )}
        </p>
      )}

      {threads.length > 0 && (
        <details className="group">
          <summary className="mb-2 flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted transition-colors hover:text-text">
            <MessageCircle className="size-3.5" />
            {threads.length > 6
              ? `Все чаты (${threads.length})`
              : `Чаты (${threads.length})`}
          </summary>
          <div className="flex flex-wrap gap-2">
            {threads.map((th) => (
              <Link
                key={th.id}
                href={`/mentor?t=${th.id}`}
                className={cn(
                  "inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                  th.id === activeThreadId
                    ? "border-gold/40 bg-gold/10 text-text"
                    : "border-line bg-surface text-muted hover:text-text",
                )}
              >
                <MessageCircle className="size-3.5 shrink-0" />
                <span className="truncate">{th.title}</span>
              </Link>
            ))}
          </div>
        </details>
      )}

      <ChatPanel
        key={activeThreadId ?? "new"}
        threadId={activeThreadId}
        initialMessages={messages}
      />
    </div>
  );
}
