import Link from "next/link";
import {
  Sparkles,
  Bot,
  Code2,
  Star,
  Clock,
  PlayCircle,
  ArrowRight,
  BookOpen,
  MessageCircle,
  Unlock,
  type LucideIcon,
} from "lucide-react";
import type { CourseIcon } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatNumber, pluralize } from "@/lib/utils";
import type { PublicCourse } from "@/data/public";

const ICONS: Record<CourseIcon, LucideIcon> = { sparkles: Sparkles, bot: Bot, code: Code2 };

export function PublicCourseCard({ course }: { course: PublicCourse }) {
  const Icon = ICONS[course.icon] ?? Sparkles;

  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex flex-col rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair transition duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="grid size-12 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
        {course.flagship && <Badge variant="gold">ФЛАГМАН</Badge>}
      </div>

      <h3 className="font-display text-lg font-bold">{course.title}</h3>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted">{course.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {course.weeks} {pluralize(course.weeks, ["неделя", "недели", "недель"])}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PlayCircle className="size-3.5" />
          {course.lessonCount} {pluralize(course.lessonCount, ["урок", "урока", "уроков"])}
        </span>
        {/* A course with no ratings yet has rating 0 — showing "★ 0" reads as
            a bad score, so the block is dropped entirely. */}
        {course.rating > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Star className="size-3.5 text-gold" />
            {course.rating}
          </span>
        )}
      </div>

      {/* "Можно попробовать" is the strongest thing a paid card can say. A free
          course says «Бесплатно» in the footer already — no counter there. */}
      {course.price > 0 && course.freeLessonCount > 0 && (
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg border border-teal/30 bg-teal/10 px-2 py-1 text-xs font-semibold text-teal">
          <Unlock className="size-3.5" />
          {course.freeLessonCount}{" "}
          {pluralize(course.freeLessonCount, ["урок", "урока", "уроков"])} бесплатно
        </p>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        {/* Paid courses are sold through a manager, so the card shows a CTA
            rather than a price tag. Free courses state it plainly. */}
        <span className="font-display text-sm font-bold">
          {course.price > 0 ? (
            <span className="text-gold">По заявке</span>
          ) : (
            <span className="text-teal">Бесплатно</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors group-hover:text-gold">
          Подробнее
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

/**
 * Shown wherever the storefront grid would otherwise be an empty box. The
 * catalogue is filled in from /admin, so a visitor arriving early gets an
 * explanation plus a way to leave a contact instead of a dead end.
 * `homeLink` is off on the landing page itself — there's nowhere to go.
 */
export function CoursesEmptyState({ homeLink = true }: { homeLink?: boolean }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
        <BookOpen className="size-7" strokeWidth={1.7} />
      </div>
      <p className="font-display text-lg font-bold">Каталог наполняется</p>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        Первые курсы готовятся к запуску. Оставьте контакт — расскажем о старте и
        поможем выбрать направление под вашу задачу.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/#zayavka"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
        >
          <MessageCircle className="size-4" />
          Оставить заявку
        </Link>
        {homeLink && (
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
          >
            На главную
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/** Formats a price for the rare places we do show one. */
export function priceLabel(price: number): string {
  return price > 0 ? `${formatNumber(price)} ₸` : "Бесплатно";
}
