import { AlertTriangle, Bot } from "lucide-react";
import { isEmailLive } from "@/lib/email";
import { isMentorLive } from "@/lib/mentor-ai";
import { Card } from "@/components/ui/card";

/**
 * "What is not actually working" banners for the owner.
 *
 * Both features degrade SILENTLY: without a provider, mail is only written to
 * the server log and the mentor answers with a canned reply — from the outside
 * everything looks fine, so a misconfigured deploy can go unnoticed for weeks.
 * Nothing is shown once both are live.
 */
export function ServiceStatus() {
  const emailLive = isEmailLive();
  const mentorLive = isMentorLive();
  if (emailLive && mentorLive) return null;

  return (
    <div className="space-y-3">
      {!emailLive && (
        <Card className="flex gap-3 border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">
              Почта не подключена — письма о сбросе пароля и уведомления не отправляются
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Студент, забывший пароль, не получит ссылку восстановления, а о выдаче
              доступа к курсу узнает, только если сам зайдёт в кабинет. Добавьте{" "}
              <span className="font-mono text-text">RESEND_API_KEY</span> и{" "}
              <span className="font-mono text-text">EMAIL_FROM</span> в{" "}
              <span className="font-mono text-text">.env.local</span> — письма пойдут
              сразу. Пока их можно увидеть только в логах сервера.
            </p>
          </div>
        </Card>
      )}

      {!mentorLive && (
        <Card className="flex gap-3 border-gold/25 bg-gold/10 p-4">
          <Bot className="mt-0.5 size-4 shrink-0 text-gold" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">
              AI-наставник работает в демо-режиме
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Студенты видят заготовленные ответы, а не живой AI. Добавьте{" "}
              <span className="font-mono text-text">GROQ_API_KEY</span> (бесплатно),{" "}
              <span className="font-mono text-text">OPENAI_API_KEY</span> или{" "}
              <span className="font-mono text-text">ANTHROPIC_API_KEY</span> в{" "}
              <span className="font-mono text-text">.env.local</span> — и наставник
              заработает по-настоящему.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
