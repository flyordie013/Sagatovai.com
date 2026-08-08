import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Bot,
  Code2,
  Star,
  Clock,
  PlayCircle,
  MessageCircle,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import type { CourseIcon } from "@/types";
import { getPublicCourse } from "@/data/public";
import { Badge } from "@/components/ui/badge";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contacts";
import { pluralize } from "@/lib/utils";
import { LeadForm } from "../../lead-form";

const ICONS: Record<CourseIcon, LucideIcon> = { sparkles: Sparkles, bot: Bot, code: Code2 };

/**
 * Course links travel by forwarding (WhatsApp/Telegram), so the preview has to
 * be about THIS course. Metadata is merged shallowly per key: declaring
 * `openGraph` here replaces the root layout's object whole, which is why the
 * card fields are restated. The preview image is the one exception — it comes
 * from the file convention (app/opengraph-image.tsx) merged into the parent
 * segment, so it has to be carried over from `parent` explicitly, otherwise
 * this page would ship a card with no picture. `twitter` follows the same
 * replace-whole rule; its image is auto-filled from openGraph.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) return { title: "Курс не найден" };

  const url = `/courses/${course.slug}`;
  const images = (await parent).openGraph?.images ?? [];

  return {
    title: course.title,
    description: course.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "OQU",
      locale: "ru_RU",
      url,
      title: course.title,
      description: course.description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: course.title,
      description: course.description,
    },
  };
}

export default async function PublicCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) notFound();

  const Icon = ICONS[course.icon] ?? Sparkles;
  // A visitor who does not want to wait for a callback: WhatsApp opens with the
  // course already named, so the manager knows what the question is about.
  const askUrl = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
    `Здравствуйте! Хочу задать вопрос по курсу «${course.title}»`,
  )}`;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        Все курсы
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        {/* ---- main ---- */}
        <div>
          <div className="flex items-start gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
              <Icon className="size-7" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
                  {course.title}
                </h1>
                {course.flagship && <Badge variant="gold">ФЛАГМАН</Badge>}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                {course.description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" />
              {course.weeks} {pluralize(course.weeks, ["неделя", "недели", "недель"])}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-4" />
              {course.lessonCount} {pluralize(course.lessonCount, ["урок", "урока", "уроков"])}
            </span>
            {/* Rating 0 means "нет оценок", not "плохой курс" — hide it. */}
            {course.rating > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 text-gold" />
                {course.rating}
              </span>
            )}
            {/* A paid course with previews is the cheapest thing to try, so it
                is stated above the fold. On a free course the whole thing is
                already free — the counter would only understate it. */}
            {course.price > 0 && course.freeLessonCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">
                <Unlock className="size-3.5" />
                {course.freeLessonCount}{" "}
                {pluralize(course.freeLessonCount, ["урок", "урока", "уроков"])} бесплатно
              </span>
            )}
          </div>

          {/* On phones the form lands under the whole curriculum — a screen and
              a half of scrolling — so the first screen gets its own way in. */}
          <Link
            href="#zayavka"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-5 py-3.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft lg:hidden"
          >
            Оставить заявку
            <ArrowRight className="size-4" />
          </Link>

          {/* ---- curriculum ---- */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Программа курса</h2>
            {course.freeLessonCount > 0 && (
              <p className="mt-2 text-sm text-muted">
                Уроки с пометкой{" "}
                <span className="font-semibold text-teal">«Бесплатно»</span> можно
                посмотреть без оплаты — достаточно зарегистрироваться.
              </p>
            )}
            <div className="mt-4 space-y-3">
              {course.modules.length === 0 && (
                <p className="text-sm text-muted">Программа скоро появится.</p>
              )}
              {course.modules.map((m, i) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-faint">Модуль {i + 1}</span>
                    <h3 className="font-display font-bold">{m.title}</h3>
                    <span className="text-xs text-muted">
                      · {m.lessons.length}{" "}
                      {pluralize(m.lessons.length, ["урок", "урока", "уроков"])}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {m.lessons.map((l) => (
                      <li key={l.id} className="flex items-start gap-2.5 text-sm text-muted">
                        <PlayCircle
                          className={`mt-0.5 size-4 shrink-0 ${l.isFree ? "text-teal" : "text-faint"}`}
                        />
                        <span className="min-w-0 flex-1">{l.title}</span>
                        {l.isFree && (
                          <span className="mt-0.5 shrink-0 rounded-md border border-teal/30 bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                            Бесплатно
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Keeps the CTA in reach while the curriculum scrolls. `sticky` at
              the end of the column rather than `fixed`: it unpins exactly where
              the form begins, so it covers neither the form nor the footer. */}
          <div className="sticky bottom-0 z-20 -mx-4 mt-10 flex items-center gap-3 border-t border-line bg-ink/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold">{course.title}</p>
              {/* Paid courses are sold through a manager — no price tag here,
                  same as on the catalogue card. */}
              <p className="text-xs font-semibold">
                {course.price > 0 ? (
                  <span className="text-gold">По заявке</span>
                ) : (
                  <span className="text-teal">Бесплатно</span>
                )}
              </p>
            </div>
            <Link
              href="#zayavka"
              className="ml-auto shrink-0 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
            >
              Оставить заявку
            </Link>
          </div>
        </div>

        {/* ---- sticky CTA ---- */}
        <aside id="zayavka" className="scroll-mt-20 lg:sticky lg:top-24">
          <div className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair sm:p-6">
            <p className="font-display text-lg font-bold">
              {course.price > 0 ? "Записаться на курс" : "Начать бесплатно"}
            </p>
            <p className="mt-1.5 mb-5 text-sm text-muted">
              {course.price > 0
                ? "Оставьте контакт — расскажем про программу, условия и откроем доступ."
                : "Оставьте контакт — откроем доступ к курсу."}
            </p>
            <LeadForm courseId={course.id} courseTitle={course.title} />

            {/* Waiting for a callback is the slowest way to get an answer — the
                same question in WhatsApp costs one tap on a phone. */}
            <div className="mt-4 border-t border-line pt-4">
              <a
                href={askUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
              >
                <MessageCircle className="size-4" />
                Задать вопрос в WhatsApp
              </a>
              <p className="mt-2 text-center text-xs text-faint">
                Ответим на вопросы о программе, доступе и оплате.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
