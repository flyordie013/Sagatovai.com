import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contacts";
import { SELLER, isLegalConfigured, isRefundConfigured } from "@/lib/legal";

export const metadata = {
  title: "Контакты",
  description: "Как связаться с OQU: WhatsApp, email и сведения о продавце.",
};

export default function ContactsPage() {
  const seller = SELLER;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Контакты</h1>
      <p className="mt-2 text-sm text-faint">
        Отвечаем на вопросы о курсах, оплате, доступе и возврате.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-text">Как с нами связаться</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair transition-colors hover:border-line-strong"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                <MessageCircle className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-bold text-text">WhatsApp</span>
                <span className="nums mt-0.5 block">{SUPPORT_PHONE_DISPLAY}</span>
                <span className="mt-1 block text-xs text-faint">
                  Самый быстрый способ — пишите в любое время.
                </span>
              </span>
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card ring-inset-hair transition-colors hover:border-line-strong"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                <Mail className="size-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-bold text-text">Email</span>
                <span className="mt-0.5 block break-words">{SUPPORT_EMAIL}</span>
                <span className="mt-1 block text-xs text-faint">
                  Для заявлений, документов и вложений.
                </span>
              </span>
            </a>
          </div>
          <p>
            Не хотите писать первым — оставьте{" "}
            <Link
              href="/#zayavka"
              className="underline underline-offset-2 transition-colors hover:text-text"
            >
              заявку на сайте
            </Link>
            , и мы свяжемся с вами сами.
          </p>
        </section>

        {seller && (
          <section className="space-y-2">
            <h2 className="font-display text-lg font-bold text-text">Сведения о продавце</h2>
            <dl className="space-y-2.5 sm:space-y-1.5">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-faint sm:w-40">Продавец</dt>
                <dd className="text-text">{seller.displayName}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-faint sm:w-40">{seller.idLabel}</dt>
                <dd className="nums text-text">{seller.id}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-faint sm:w-40">Адрес</dt>
                <dd className="text-text">{seller.address}</dd>
              </div>
              {seller.phone && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-faint sm:w-40">Телефон</dt>
                  <dd className="nums text-text">{seller.phone}</dd>
                </div>
              )}
              {seller.email && (
                <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                  <dt className="shrink-0 text-faint sm:w-40">Email</dt>
                  <dd className="break-words text-text">{seller.email}</dd>
                </div>
              )}
              {seller.bank && (
                <>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 text-faint sm:w-40">Банк</dt>
                    <dd className="text-text">{seller.bank.name}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 text-faint sm:w-40">БИК</dt>
                    <dd className="nums text-text">{seller.bank.bic}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                    <dt className="shrink-0 text-faint sm:w-40">IBAN</dt>
                    <dd className="nums break-words text-text">{seller.bank.iban}</dd>
                  </div>
                </>
              )}
            </dl>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Документы</h2>
          <ul className="space-y-1.5">
            {isLegalConfigured && (
              <li>
                <Link
                  href="/offer"
                  className="underline underline-offset-2 transition-colors hover:text-text"
                >
                  Публичная оферта
                </Link>{" "}
                — на каких условиях мы продаём доступ к курсам.
              </li>
            )}
            {isRefundConfigured && (
              <li>
                <Link
                  href="/refund"
                  className="underline underline-offset-2 transition-colors hover:text-text"
                >
                  Условия возврата
                </Link>{" "}
                — когда и как можно вернуть деньги.
              </li>
            )}
            <li>
              <Link
                href="/privacy"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                Политика конфиденциальности
              </Link>{" "}
              — как мы обрабатываем персональные данные.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
