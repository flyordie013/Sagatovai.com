import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy, PlayCircle, ClipboardCheck, MessageCircle } from "lucide-react";
import { listPublicCourses } from "@/data/public";
import { PublicCourseCard, CoursesEmptyState } from "./public-course-card";
import { LeadForm } from "./lead-form";

export const metadata: Metadata = {
  title: "OQU — практическое обучение AI",
  description:
    "Практические курсы по искусственному интеллекту на русском языке: от первого промпта до готового проекта.",
  // Relative — resolved against metadataBase from app/layout.tsx.
  alternates: { canonical: "/" },
};

const STEPS = [
  {
    icon: PlayCircle,
    title: "Смотрите короткие уроки",
    text: "Каждый урок — одна тема и практика. Без воды и трёхчасовых лекций.",
  },
  {
    icon: ClipboardCheck,
    title: "Закрепляете на практике",
    text: "Материалы и задания помогают сразу применить каждую тему к своей задаче.",
  },
  {
    icon: Trophy,
    title: "Собираете реальный проект",
    text: "За уроки начисляется опыт, растут уровни и ранги. К концу курса — работающий результат.",
  },
];

export default async function LandingPage() {
  const courses = await listPublicCourses();

  return (
    <>
      {/* ---------------- hero ---------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
        />
        <div className="relative mx-auto max-w-[1120px] px-4 py-20 text-center sm:px-6 sm:py-28">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
            Образовательная платформа
          </p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
            Освойте <span className="text-gold">искусственный интеллект</span> и соберите
            проект, который приносит деньги
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Практические курсы на русском языке — от первого промпта до готового продукта.
            Все уроки доступны сразу после открытия курса администратором.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#zayavka"
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
            >
              Оставить заявку
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-6 py-3.5 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
            >
              Смотреть курсы
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- courses ---------------- */}
      <section id="courses" className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20">
        <header className="mb-8">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
            Программы
          </p>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Курсы</h2>
        </header>

        {courses.length === 0 ? (
          <CoursesEmptyState homeLink={false} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <PublicCourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      {/* ---------------- how it works ---------------- */}
      <section className="border-y border-line bg-surface/40">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20">
          <header className="mb-8">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
              Как это работает
            </p>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
              Обучение, которое доводит до результата
            </h2>
          </header>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair"
              >
                <div className="mb-4 grid size-11 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                  <s.icon className="size-5" strokeWidth={1.8} />
                </div>
                <h3 className="font-display font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- lead form ---------------- */}
      <section id="zayavka" className="border-t border-line bg-surface/40 scroll-mt-20">
        <div className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
                <MessageCircle className="size-3.5" />
                Заявка
              </p>
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                Расскажем, с чего начать
              </h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
                Оставьте контакт — свяжемся, подберём курс под вашу задачу и откроем доступ.
                Доступ к выбранному курсу откроет администратор после подтверждения оплаты.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair sm:p-6">
              <LeadForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
