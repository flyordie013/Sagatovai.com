import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play, Check } from "lucide-react";
import { listPublicCourses, getPublicCourse } from "@/data/public";
import { PublicCourseCard, CoursesEmptyState } from "./public-course-card";
import { LeadForm } from "./lead-form";

export const metadata: Metadata = {
  title: "Практические курсы по искусственному интеллекту",
  description: "Выберите курс по AI, изучите программу и занимайтесь в своём темпе. Видеоуроки и материалы в одном личном кабинете.",
  alternates: { canonical: "/" },
};

const faq = [
  ["В каком порядке смотреть уроки?", "После открытия доступа все уроки курса доступны сразу. Можно идти по программе или выбирать нужную тему. Обязательного просмотра и блокировки следующих уроков нет."],
  ["Как получить доступ к курсу?", "Выберите курс и оставьте заявку. Мы свяжемся с вами, уточним условия и способ оплаты. После подтверждения оплаты администратор откроет выбранный курс в вашем аккаунте."],
  ["Можно заниматься с телефона?", "Да. Кабинет, видео и материалы доступны в браузере телефона. Для практических заданий могут понадобиться компьютер и отдельные сервисы — проверьте требования выбранного курса."],
  ["Нужно ли покупать подписки на AI-сервисы?", "Это зависит от программы. Уточните список инструментов и возможные расходы до оплаты — через форму на странице курса."],
  ["На какой срок открывается курс?", "Срок доступа и формат поддержки указываются в условиях конкретного курса. Если их нет на странице, мы уточним их при оформлении заявки."],
];

export default async function LandingPage() {
  const courses = await listPublicCourses();
  const featured = courses[0] ? await getPublicCourse(courses[0].slug) : null;
  const preview = featured?.modules.flatMap((m) => m.lessons).slice(0, 4) || [];
  return <>
    <section className="border-b border-line">
      <div className="page-section grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="eyebrow mb-6">OQU / Практическое обучение AI</p>
          <h1 className="max-w-[14ch] text-[clamp(2.8rem,5.4vw,4.8rem)] font-semibold leading-[1.04] tracking-[-0.045em]">Разберитесь в AI.<br /><span className="editorial text-gold">Примените в деле.</span></h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted sm:text-lg">Курсы на русском языке, в которых можно вернуться к нужной теме, повторить шаги и работать над своей задачей.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="#courses" className="btn-primary">Выбрать курс <ArrowRight className="size-4" /></Link><Link href="#zayavka" className="btn-secondary">Помогите с выбором</Link></div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted"><span>На русском языке</span><span>В своём темпе</span><span>С компьютера и телефона</span></div>
        </div>
        {featured && <div className="relative border-l-2 border-gold bg-surface p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4"><p className="eyebrow">Загляните в программу</p><span className="font-mono text-xs text-muted">01 / OQU</span></div>
          <h2 className="mt-8 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{featured.title}</h2>
          <ol className="mt-7 divide-y divide-line-strong border-y border-line-strong">{preview.map((lesson, i) => <li key={lesson.id} className="flex gap-4 py-4 text-sm"><span className="font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</span><span>{lesson.title}</span></li>)}</ol>
          <Link href={`/courses/${featured.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold">Программа и условия <ArrowRight className="size-4" /></Link>
        </div>}
      </div>
    </section>
    <section id="courses" className="page-section scroll-mt-20">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-3">Программы</p><h2 className="section-title">Выберите свою задачу</h2></div><p className="max-w-sm text-sm leading-relaxed text-muted">Посмотрите темы уроков и требования. Если сомневаетесь — поможем разобраться.</p></div>
      {courses.length ? <div className="grid gap-5 md:grid-cols-2">{courses.map((course, index) => <PublicCourseCard key={course.id} course={course} index={index} />)}</div> : <CoursesEmptyState homeLink={false} />}
    </section>
    <section id="format" className="scroll-mt-20 border-y border-line bg-surface/50">
      <div className="page-section grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div><p className="eyebrow mb-3">Как вы будете учиться</p><h2 className="section-title max-w-sm">Один кабинет.<br />Ваш темп.</h2><p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">Откройте урок, разберите тему и вернитесь к практике. Программа помогает ориентироваться, а порядок выбираете вы.</p></div>
        <div className="divide-y divide-line-strong">{[
          ["01", "Смотрите и повторяйте", "Управляйте скоростью, перематывайте и возвращайтесь к отдельным моментам видео."],
          ["02", "Держите материалы под рукой", "Прикреплённые к уроку файлы доступны под видео: их можно скачать для работы."],
          ["03", "Продолжайте с места остановки", "Кабинет запоминает последний урок и позицию видео. Отмечайте завершённые темы для себя."],
        ].map(([n, title, text]) => <div key={n} className="flex gap-5 py-6 first:pt-0 last:pb-0"><span className="pt-1 font-mono text-xs text-gold">{n}</span><div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">{text}</p></div></div>)}</div>
      </div>
    </section>
    <section className="page-section">
      <p className="eyebrow mb-3">От выбора до первого урока</p><h2 className="section-title max-w-xl">Понятно, что будет дальше</h2>
      <ol className="mt-10 grid gap-8 md:grid-cols-3">{[
        ["Выберите курс", "Изучите программу или оставьте заявку, чтобы уточнить, подходит ли она под вашу задачу."],
        ["Уточните условия", "Согласуйте стоимость, срок доступа и способ оплаты до покупки."],
        ["Начните обучение", "После подтверждения оплаты откроем курс именно вашему аккаунту. Все его уроки станут доступны сразу."],
      ].map(([title, text], i) => <li key={title} className="border-t border-line-strong pt-5"><span className="font-mono text-xs text-gold">0{i + 1}</span><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted">{text}</p></li>)}</ol>
    </section>
    <section id="questions" className="page-section scroll-mt-20 border-t border-line">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]"><div><p className="eyebrow mb-3">Перед началом</p><h2 className="section-title">Частые вопросы</h2><Link href="/contacts" className="mt-6 inline-flex text-sm text-gold underline underline-offset-4">Задать свой вопрос</Link></div><div className="divide-y divide-line-strong">{faq.map(([q, a]) => <details key={q} className="group py-5 first:pt-0"><summary className="cursor-pointer text-base font-semibold leading-relaxed">{q}</summary><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{a}</p></details>)}</div></div>
    </section>
    <section id="zayavka" className="scroll-mt-20 border-t border-line bg-surface">
      <div className="page-section grid gap-10 lg:grid-cols-2"><div><p className="eyebrow mb-3">Начнём с вашей задачи</p><h2 className="section-title max-w-md">Не знаете,<br />какой курс выбрать?</h2><p className="mt-5 max-w-md text-sm leading-relaxed text-muted">Расскажите, что хотите сделать с помощью AI. Поможем выбрать программу и объясним условия обучения.</p><p className="mt-6 flex items-center gap-2 text-xs text-muted"><Check className="size-4" /> Заявка ни к чему не обязывает</p><Link href="/courses" className="mt-6 inline-flex items-center gap-2 text-sm text-gold"><Play className="size-4" /> Уже выбрали? Откройте страницу курса</Link></div><div className="rounded-2xl border border-line-strong bg-ink p-5 sm:p-7"><LeadForm /></div></div>
    </section>
  </>;
}
