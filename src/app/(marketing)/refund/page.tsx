import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SUPPORT_EMAIL } from "@/lib/contacts";
import { LEGAL_UPDATED, REFUND, SELLER } from "@/lib/legal";
import { pluralize } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Условия возврата",
  description:
    "В какой срок и на каких условиях можно вернуть оплату за доступ к онлайн-курсу OQU и как подать заявление.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  // Both the seller and the refund window come from LEGAL_* (see
  // src/lib/legal.ts). Publishing a refund policy with invented deadlines
  // would be a promise the owner never made — so until they are set, the page
  // does not exist.
  const seller = SELLER;
  const refund = REFUND;
  if (!seller || !refund) notFound();

  const days = `${refund.days} ${pluralize(refund.days, ["дня", "дней", "дней"])}`;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Условия возврата</h1>
      {LEGAL_UPDATED && <p className="mt-2 text-sm text-faint">Редакция от {LEGAL_UPDATED}</p>}

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <p>
          Здесь описано, в какой срок и на каких условиях {seller.displayName} возвращает
          оплату за доступ к онлайн-курсам платформы OQU. Эти условия являются неотъемлемой
          частью{" "}
          <Link
            href="/offer"
            className="underline underline-offset-2 transition-colors hover:text-text"
          >
            публичной оферты
          </Link>
          .
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Срок обращения</h2>
          <p>
            Заявление на возврат принимается в течение <span className="nums">{days}</span> с
            даты оплаты курса. Срок считается от дня, когда оплата поступила Исполнителю.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Когда возврат возможен</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>обращение поступило в течение указанного выше срока;</li>
            {refund.maxProgressPercent === 0 && (
              <li>
                вы ещё не приступили к прохождению курса — ни один урок не отмечен как
                пройденный;
              </li>
            )}
            {refund.maxProgressPercent !== undefined && refund.maxProgressPercent > 0 && (
              <li>
                пройдено не более{" "}
                <span className="nums">{refund.maxProgressPercent}%</span> материала курса —
                прогресс виден в вашем личном кабинете;
              </li>
            )}
            <li>условия оферты не были нарушены (см. раздел ниже).</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Как подать заявление</h2>
          <p>
            Напишите нам на почту{" "}
            <a
              href={`mailto:${seller.email ?? SUPPORT_EMAIL}`}
              className="underline underline-offset-2 transition-colors hover:text-text"
            >
              {seller.email ?? SUPPORT_EMAIL}
            </a>{" "}
            и укажите:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>фамилию, имя и контакты, по которым оформлялась покупка;</li>
            <li>название курса и дату оплаты;</li>
            <li>причину обращения — она помогает нам стать лучше;</li>
            <li>реквизиты для возврата, если оплата была не банковской картой.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            Рассмотрение и перечисление
          </h2>
          <p>
            Мы подтверждаем получение заявления и сообщаем решение по тем же контактам.
            Возврат производится тем же способом, которым была произведена оплата, и на
            реквизиты плательщика.
            {refund.payoutDays !== undefined && (
              <>
                {" "}
                Деньги перечисляются в течение{" "}
                <span className="nums">
                  {refund.payoutDays}{" "}
                  {pluralize(refund.payoutDays, ["рабочего дня", "рабочих дней", "рабочих дней"])}
                </span>{" "}
                с момента согласования возврата; срок зачисления на стороне банка может
                отличаться.
              </>
            )}
          </p>
          <p>С момента возврата оплаты доступ к курсу закрывается.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            Когда возврат не производится
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>истёк срок обращения, указанный выше;</li>
            {refund.maxProgressPercent !== undefined && (
              <li>пройдено больше материала курса, чем допускают условия выше;</li>
            )}
            <li>
              доступ к аккаунту передавался третьим лицам, а материалы курса копировались,
              записывались или распространялись;
            </li>
            <li>
              курс был получен в подарок, по промо-условиям или в составе акции, прямо
              исключающей возврат.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Если дело не в возврате</h2>
          <p>
            Часто вопрос решается быстрее: не открывается урок, не пришли данные для входа,
            курс оказался не того уровня. Напишите нам — мы поможем с доступом или подберём
            подходящую программу. Все контакты собраны на странице{" "}
            <Link
              href="/contacts"
              className="underline underline-offset-2 transition-colors hover:text-text"
            >
              «Контакты»
            </Link>
            .
          </p>
        </section>

        <p className="text-xs text-faint">
          Настоящие условия не ограничивают прав потребителя, предусмотренных
          законодательством Республики Казахстан.
        </p>
      </div>
    </div>
  );
}
