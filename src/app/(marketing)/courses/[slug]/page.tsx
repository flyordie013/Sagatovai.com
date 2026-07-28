import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Bot, Code2, Star, Clock, PlayCircle, type LucideIcon } from "lucide-react";
import type { CourseIcon } from "@/types";
import { getPublicCourse } from "@/data/public";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/utils";
import { LeadForm } from "../../lead-form";

const ICONS: Record<CourseIcon, LucideIcon> = { sparkles: Sparkles, bot: Bot, code: Code2 };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) return { title: "Курс не найден" };
  return { title: course.title, description: course.description };
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
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-4 text-gold" />
              {course.rating}
            </span>
          </div>

          {/* ---- curriculum ---- */}
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold">Программа курса</h2>
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
                        <PlayCircle className="mt-0.5 size-4 shrink-0 text-faint" />
                        {l.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---- sticky CTA ---- */}
        <aside className="lg:sticky lg:top-24">
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
          </div>
        </aside>
      </div>
    </div>
  );
}
