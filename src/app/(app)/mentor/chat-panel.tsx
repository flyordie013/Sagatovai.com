"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bot, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendMessage } from "./actions";
import type { MentorMessage } from "@/data/mentor";

const QUICK_PROMPTS = [
  "Объясни тему последнего урока простыми словами",
  "Как настроить вебхук в n8n?",
  "Где взять API-ключ и как его безопасно хранить?",
  "С чего начать проект на AI?",
];

type Msg = { id: number; role: "user" | "assistant"; content: string; pending?: boolean };

export function ChatPanel({
  threadId,
  initialMessages,
}: {
  threadId: string | null;
  initialMessages: MentorMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [tid, setTid] = useState<string | null>(threadId);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const tempId = useRef(-1);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function submit(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    setInput("");
    const userMsg: Msg = { id: tempId.current--, role: "user", content };
    const typing: Msg = { id: tempId.current--, role: "assistant", content: "", pending: true };
    setMessages((m) => [...m, userMsg, typing]);

    startTransition(async () => {
      const res = await sendMessage(tid, content);
      if (!res.ok) {
        setError(res.error ?? "Не удалось отправить сообщение");
        // Drop the optimistic pair and give the text back so nothing is lost.
        setMessages((m) => m.filter((x) => !x.pending && x.id !== userMsg.id));
        setInput(content);
        return;
      }
      setMessages((m) =>
        m.map((x) =>
          x.pending
            ? { id: x.id, role: "assistant", content: res.reply ?? "" }
            : x,
        ),
      );
      if (res.threadId && res.threadId !== tid) {
        setTid(res.threadId);
        // Sync the URL to the real thread; otherwise the page stays on ?t=new
        // and a later click on "Новый чат" is not a navigation (no-op).
        router.replace(`/mentor?t=${res.threadId}`);
      }
    });
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* messages */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-gold/30 bg-gold/10 text-gold shadow-glow">
              <Bot className="size-7" strokeWidth={1.7} />
            </div>
            <div>
              <p className="font-display text-lg font-bold">Спроси меня о чём угодно</p>
              <p className="mt-1 text-sm text-muted">
                Разберу тему урока, помогу с кодом или проектом.
              </p>
            </div>
            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="rounded-full border border-line-strong bg-raised px-3 py-1.5 text-xs text-muted transition-colors hover:border-gold/40 hover:text-text"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} msg={m} />)
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="border-t border-line px-4 py-2 text-xs text-danger">{error}</p>
      )}

      {/* composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-end gap-2 border-t border-line bg-ink/40 p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          placeholder="Напиши сообщение…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-faint focus:border-gold/50"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Отправить"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
        </button>
      </form>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
          <Bot className="size-4.5" strokeWidth={1.9} />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-gold/15 text-text"
            : "border border-line bg-raised text-text",
        )}
      >
        {msg.pending ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Loader2 className="size-3.5 animate-spin" /> печатает…
          </span>
        ) : (
          msg.content
        )}
      </div>
    </div>
  );
}
