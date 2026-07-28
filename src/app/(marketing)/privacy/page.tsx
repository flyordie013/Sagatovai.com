export const metadata = {
  title: "Политика конфиденциальности",
  description: "Как OQU обрабатывает и защищает персональные данные пользователей.",
};

const UPDATED = "24 июля 2026 г.";

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
            необходимый для оказания услуг. Пароли хранятся в зашифрованном виде.
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
            По вопросам обработки персональных данных свяжитесь с нами через форму заявки на
            сайте.
          </p>
        </section>

        <p className="text-xs text-faint">
          Это базовая версия документа. Перед публичным запуском рекомендуем согласовать текст с
          юристом с учётом требований Закона Республики Казахстан «О персональных данных и их
          защите».
        </p>
      </div>
    </div>
  );
}
