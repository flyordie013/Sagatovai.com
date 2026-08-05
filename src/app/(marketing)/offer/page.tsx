import Link from "next/link";
import { notFound } from "next/navigation";
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contacts";
import { ACCESS_MONTHS, LEGAL_UPDATED, SELLER, isRefundConfigured } from "@/lib/legal";
import { pluralize } from "@/lib/utils";

export const metadata = {
  title: "Публичная оферта",
  description:
    "Условия, на которых OQU продаёт доступ к онлайн-курсам: оформление покупки, передача доступа, срок, права и обязанности сторон.",
};

export default function OfferPage() {
  // No seller details — no contract. A public offer signed by nobody is worse
  // than a missing page, so the route simply does not exist until the owner
  // fills LEGAL_* in (see src/lib/legal.ts).
  const seller = SELLER;
  if (!seller) notFound();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Публичная оферта</h1>
      {LEGAL_UPDATED && <p className="mt-2 text-sm text-faint">Редакция от {LEGAL_UPDATED}</p>}

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <p>
          Настоящий документ является публичной офертой — предложением {seller.displayName}{" "}
          (далее — «Исполнитель») заключить договор возмездного оказания услуг на условиях,
          изложенных ниже. Договор считается заключённым с момента оплаты (акцепта) любым
          физическим лицом (далее — «Ученик»).
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">1. Общие положения</h2>
          <p>
            Оферта размещена на сайте платформы OQU и действует до момента её отзыва или
            замены новой редакцией. Оплачивая доступ к курсу, Ученик подтверждает, что
            ознакомился с условиями оферты, принимает их полностью и без оговорок, а также
            подтверждает свою дееспособность для заключения договора.
          </p>
          <p>
            Исполнитель вправе изменять условия оферты. Новая редакция публикуется на этой
            странице и применяется к покупкам, совершённым после её публикации; к уже
            оплаченным курсам применяются условия, действовавшие на момент оплаты.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">2. Предмет договора</h2>
          <p>
            Исполнитель предоставляет Ученику доступ к выбранному онлайн-курсу на платформе
            OQU, а Ученик оплачивает этот доступ. В доступ входит то, что описано на странице
            конкретного курса, — как правило это:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>видеоуроки и сопровождающие материалы курса;</li>
            <li>практические задания и проверка прогресса в личном кабинете;</li>
            <li>AI-наставник, который отвечает на вопросы по проходимому уроку.</li>
          </ul>
          <p>
            Услуги носят информационно-консультационный характер. Состав курса, его программа
            и стоимость указываются на странице курса и уточняются при оформлении покупки.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            3. Как оформляется покупка
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Ученик оставляет заявку на сайте или пишет Исполнителю по контактам, указанным
              на странице{" "}
              <Link
                href="/contacts"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                «Контакты»
              </Link>
              .
            </li>
            <li>
              Стороны согласовывают курс, его стоимость и способ оплаты. Стоимость указывается
              в тенге; применяется цена, действующая на момент оплаты.
            </li>
            <li>
              Ученик производит оплату. Оплата означает согласие с настоящей офертой и{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                политикой конфиденциальности
              </Link>
              .
            </li>
          </ul>
          <p>
            Услуга считается оказанной надлежащим образом с момента открытия Ученику доступа к
            курсу, если Ученик не заявил возражений в порядке, описанном в разделе о возврате.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">4. Как передаётся доступ</h2>
          <p>
            Доступ предоставляется в личном кабинете на платформе OQU. После подтверждения
            оплаты Исполнитель открывает доступ к курсу для аккаунта Ученика и сообщает данные
            для входа по указанным Учеником контактам. Отдельная передача материалов файлами,
            на носителях или по почте не производится.
          </p>
          <p>
            Аккаунт является персональным. Ученик отвечает за сохранность своего пароля и за
            все действия, совершённые под его учётной записью.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">5. Срок доступа</h2>
          <p>
            {ACCESS_MONTHS !== undefined ? (
              <>
                Доступ к курсу предоставляется на {ACCESS_MONTHS}{" "}
                {pluralize(ACCESS_MONTHS, ["месяц", "месяца", "месяцев"])} с момента открытия,
                если на странице курса не указан иной срок.
              </>
            ) : (
              <>
                Срок доступа указывается в описании конкретного курса и согласовывается при
                оформлении покупки.
              </>
            )}{" "}
            В течение срока доступа Ученик может проходить курс в удобном ему темпе.
          </p>
          <p>
            Исполнитель вправе дополнять и обновлять материалы курса. Возможны краткие
            технические перерывы в работе платформы, связанные с обслуживанием или сбоями на
            стороне провайдеров; на срок доступа они не влияют существенным образом.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            6. Права и обязанности Исполнителя
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              открыть доступ к оплаченному курсу и поддерживать работоспособность платформы в
              течение срока доступа;
            </li>
            <li>
              отвечать на вопросы Ученика по организационным моментам — оплате, доступу,
              работе платформы;
            </li>
            <li>
              изменять состав и структуру уроков, не ухудшая при этом заявленный результат
              курса;
            </li>
            <li>
              приостановить или прекратить доступ без возврата оплаты, если Ученик нарушает
              условия оферты — в частности, передаёт доступ третьим лицам или распространяет
              материалы курса.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            7. Права и обязанности Ученика
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              указывать при оформлении достоверные данные и поддерживать их в актуальном
              состоянии;
            </li>
            <li>
              использовать материалы курса только лично, в личных целях, и не передавать
              доступ к аккаунту третьим лицам;
            </li>
            <li>
              не копировать, не записывать, не публиковать и не перепродавать материалы курса
              полностью или частично;
            </li>
            <li>
              обеспечить со своей стороны оборудование и интернет-соединение, необходимые для
              просмотра уроков;
            </li>
            <li>
              обращаться к Исполнителю при любых проблемах с доступом — по контактам,
              указанным на сайте.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            8. Интеллектуальная собственность
          </h2>
          <p>
            Все материалы курса — видео, тексты, задания, оформление платформы — принадлежат
            Исполнителю либо используются им на законных основаниях. Оплата даёт Ученику право
            личного просмотра и использования материалов в период доступа и не передаёт ему
            исключительных прав. Любое копирование, публикация, передача или коммерческое
            использование материалов без письменного согласия Исполнителя не допускаются.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            9. Ответственность и ограничения
          </h2>
          <p>
            Исполнитель предоставляет знания, инструменты и обратную связь, но не гарантирует
            конкретного заработка, трудоустройства или иного коммерческого результата:
            результат обучения зависит в том числе от усилий, опыта и обстоятельств самого
            Ученика.
          </p>
          <p>
            Ответы AI-наставника носят вспомогательный характер и могут содержать неточности —
            их следует проверять. Исполнитель не отвечает за перебои, вызванные сбоями на
            стороне Ученика (оборудование, интернет) или третьих лиц (хостинг, платёжные
            сервисы, мессенджеры, поставщики AI-моделей), а также за обстоятельства
            непреодолимой силы. При длительной недоступности платформы по вине Исполнителя
            срок доступа продлевается на соответствующий период.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            10. Возврат оплаты
          </h2>
          {isRefundConfigured ? (
            <p>
              Условия и порядок возврата описаны на отдельной странице —{" "}
              <Link
                href="/refund"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                «Условия возврата»
              </Link>
              . Она является неотъемлемой частью настоящей оферты.
            </p>
          ) : (
            <p>
              Вопрос возврата оплаты решается по письменному заявлению Ученика, направленному
              Исполнителю по контактам, указанным на сайте, в соответствии с
              законодательством Республики Казахстан.
            </p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            11. Персональные данные
          </h2>
          <p>
            Оформляя покупку, Ученик соглашается на обработку своих персональных данных в
            объёме и на условиях, описанных в{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 transition-colors hover:text-text"
            >
              политике конфиденциальности
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">
            12. Заключительные положения
          </h2>
          <p>
            Договор действует до полного исполнения сторонами своих обязательств. Ко всему,
            что не урегулировано настоящей офертой, применяется законодательство Республики
            Казахстан. Споры стороны решают путём переговоров, а при недостижении согласия — в
            порядке, установленном законодательством Республики Казахстан.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">13. Реквизиты Исполнителя</h2>
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
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 text-faint sm:w-40">Телефон</dt>
              <dd className="nums text-text">
                {seller.phone ?? (
                  <a
                    href={SUPPORT_WHATSAPP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 transition-colors hover:text-gold"
                  >
                    {SUPPORT_PHONE_DISPLAY}
                  </a>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <dt className="shrink-0 text-faint sm:w-40">Email</dt>
              <dd className="break-words text-text">{seller.email ?? SUPPORT_EMAIL}</dd>
            </div>
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
      </div>
    </div>
  );
}
