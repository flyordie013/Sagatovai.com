import { AlertTriangle, Bot, Scale, Undo2, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { isEmailLive } from "@/lib/email";
import { isMentorLive } from "@/lib/mentor-ai";
import { isPaymentConfigured } from "@/lib/payment";
import { isLegalConfigured, isRefundConfigured } from "@/lib/legal";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * "What is not actually working" banners for the owner.
 *
 * Everything listed here degrades SILENTLY: mail is only written to the server
 * log, the mentor answers with a canned reply, the checkout screen never
 * appears, /offer and /refund answer 404. From the outside the site looks fine,
 * so a half-configured deploy can go unnoticed for weeks — and the owner would
 * never learn that half the platform is switched off. Nothing is rendered once
 * everything is configured.
 */

/** Name of a setting — every card points at settings the same way. */
function Env({ children }: { children: string }) {
  return <span className="font-mono text-text">{children}</span>;
}

interface Issue {
  key: string;
  icon: LucideIcon;
  /** danger — money or access is blocked right now; warn — works, but poorer. */
  tone: "danger" | "warn";
  title: string;
  body: ReactNode;
}

const TONE = {
  danger: { card: "border-danger/30 bg-danger/10", icon: "text-danger" },
  warn: { card: "border-gold/25 bg-gold/10", icon: "text-gold" },
} as const;

function collectIssues(): Issue[] {
  const issues: Issue[] = [];

  if (!isEmailLive()) {
    issues.push({
      key: "email",
      icon: AlertTriangle,
      tone: "danger",
      title: "Почта не подключена — письма о сбросе пароля и уведомления не отправляются",
      body: (
        <>
          Студент, забывший пароль, не получит ссылку восстановления, а о выдаче доступа
          к курсу узнает, только если сам зайдёт в кабинет. Вы не получите и письмо
          о новой заявке. Заполните <Env>RESEND_API_KEY</Env> и <Env>EMAIL_FROM</Env> —
          письма пойдут сразу. Пока их можно увидеть только в логах сервера.
        </>
      ),
    });
  }

  if (!isPaymentConfigured) {
    issues.push({
      key: "payment",
      icon: Wallet,
      tone: "danger",
      title: "Реквизиты оплаты не заданы — студенту негде увидеть, куда платить",
      body: (
        <>
          После заявки на платный курс он видит только «менеджер свяжется с вами»: ни
          номера для перевода, ни кнопки «Отправить чек в WhatsApp». Каждую оплату
          придётся доводить вручную, а часть людей просто уйдёт. Заполните{" "}
          <Env>KASPI_NUMBER</Env> — телефон или номер карты, достаточно одного, — либо{" "}
          <Env>KASPI_LINK</Env> (ссылка, открывающая Kaspi). По желанию:{" "}
          <Env>KASPI_RECIPIENT</Env> (имя получателя, как его увидит плательщик) и{" "}
          <Env>PAYMENT_NOTE</Env> (что указать в комментарии к переводу).
        </>
      ),
    });
  }

  if (!isLegalConfigured) {
    issues.push({
      key: "legal",
      icon: Scale,
      tone: "danger",
      title: "Оферта и реквизиты продавца не опубликованы",
      body: (
        <>
          Страницы «Публичная оферта» и «Возврат» не существуют — открываются как 404,
          ссылок на них нет ни в подвале сайта, ни в карте сайта. То есть курсы
          продаются без опубликованных условий сделки и без сведений о продавце.
          Заполните <Env>LEGAL_ENTITY_NAME</Env> (название или ФИО как в регистрации),{" "}
          <Env>LEGAL_ID</Env> (БИН или ИИН) и <Env>LEGAL_ADDRESS</Env> — этого хватит,
          чтобы оферта появилась. Странице возврата нужен ещё и{" "}
          <Env>LEGAL_REFUND_DAYS</Env>.
        </>
      ),
    });
  } else if (!isRefundConfigured) {
    issues.push({
      key: "refund",
      icon: Undo2,
      tone: "warn",
      title: "Страница возврата не опубликована",
      body: (
        <>
          Оферта работает, а «Возврат» отдаёт 404: срок, в течение которого вы
          принимаете заявление на возврат, никто не вправе придумать за вас. Укажите{" "}
          <Env>LEGAL_REFUND_DAYS</Env> — число дней от 1 до 365. По желанию:{" "}
          <Env>LEGAL_REFUND_PROGRESS_PERCENT</Env> (сколько процентов курса допустимо
          пройти) и <Env>LEGAL_REFUND_PAYOUT_DAYS</Env> (за сколько дней возвращаете
          деньги).
        </>
      ),
    });
  }

  if (!isMentorLive()) {
    issues.push({
      key: "mentor",
      icon: Bot,
      tone: "warn",
      title: "AI-наставник работает в демо-режиме",
      body: (
        <>
          Студенты видят заготовленные ответы, а не живой AI. Добавьте{" "}
          <Env>GROQ_API_KEY</Env> (бесплатно), <Env>OPENAI_API_KEY</Env> или{" "}
          <Env>ANTHROPIC_API_KEY</Env> — и наставник заработает по-настоящему.
        </>
      ),
    });
  }

  return issues;
}

export function ServiceStatus() {
  const issues = collectIssues();
  if (issues.length === 0) return null;

  return (
    <div className="space-y-3">
      {issues.map(({ key, icon: Icon, tone, title, body }) => (
        <Card key={key} className={cn("flex gap-3 p-4", TONE[tone].card)}>
          <Icon className={cn("mt-0.5 size-4 shrink-0", TONE[tone].icon)} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        </Card>
      ))}
      {/* Where the settings above actually live — otherwise each card would
          have to repeat it, and a changed value silently does nothing until
          the app is restarted. */}
      <p className="text-xs leading-relaxed text-faint">
        Настройки лежат в файле <Env>.env</Env> рядом с <Env>docker-compose.yml</Env> на
        сервере (при локальной разработке — <Env>.env.local</Env>). После правки
        перезапустите приложение: <Env>docker compose up -d</Env>. Подробнее —
        в <Env>DEPLOY.md</Env>.
      </p>
    </div>
  );
}
