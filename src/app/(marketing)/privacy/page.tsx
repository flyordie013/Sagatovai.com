import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Как OQU обрабатывает и защищает персональные данные пользователей.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "29 июля 2026 г.";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
        Политика конфиденциальности
      </h1>
      <p className="mt-2 text-sm text-faint">Обновлено: {UPDATED}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted">
        <p>
          Настоящая политика описывает, какие персональные данные мы собираем на платформе
          OQU и как их используем. Оставляя заявку или регистрируясь, вы соглашаетесь с
          условиями этой политики.
        </p>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Какие данные мы собираем</h2>
          <p>
            Имя и контактные данные (телефон, WhatsApp или email), которые вы указываете в
            форме заявки или при регистрации; данные об обучении (пройденные уроки, прогресс);
            технические данные, необходимые для работы сервиса.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Как мы используем данные</h2>
          <p>
            Чтобы связаться с вами по заявке, предоставить доступ к курсам, вести ваш прогресс
            обучения и улучшать платформу. Мы не продаём ваши данные третьим лицам.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Хранение и защита</h2>
          <p>
            Данные хранятся на защищённых серверах. Доступ к ним имеет ограниченный круг лиц,
            необходимый для оказания услуг. Пароли хранятся в зашифрованном виде. Мы храним
            данные, пока действует ваш аккаунт или пока это необходимо для оказания услуг, —
            и удаляем их по вашему запросу.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Передача третьим лицам</h2>
          <p>
            Мы не продаём и не передаём ваши данные третьим лицам, кроме случаев, когда это
            необходимо для работы сервиса (хостинг, отправка писем, мессенджеры для связи с
            вами) или прямо требуется законодательством Республики Казахстан.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Ваши права</h2>
          <p>
            Вы можете запросить доступ к своим данным, их исправление или удаление, а также
            отозвать согласие на обработку — напишите нам по контактам ниже.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-text">Контакты</h2>
          <p>
            По любым вопросам об обработке персональных данных — доступ, исправление,
            удаление, отзыв согласия — напишите нам:
          </p>
          <ul className="space-y-1.5">
            <li>
              WhatsApp:{" "}
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                {SUPPORT_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              Или оставьте заявку через{" "}
              <Link
                href="/#zayavka"
                className="underline underline-offset-2 transition-colors hover:text-text"
              >
                форму на сайте
              </Link>
              .
            </li>
          </ul>
        </section>

        <p className="text-xs text-faint">
          Обработка персональных данных ведётся в соответствии с законодательством Республики
          Казахстан, в том числе с Законом «О персональных данных и их защите».
        </p>
      </div>
    </div>
  );
}
