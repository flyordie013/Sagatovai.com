import Link from "next/link";
import { Sparkles, Bot, Code2, Star, Clock, PlayCircle, ArrowRight, type LucideIcon } from "lucide-react";
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
        <span className="inline-flex items-center gap-1.5">
          <Star className="size-3.5 text-gold" />
          {course.rating}
        </span>
      </div>

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

/** Formats a price for the rare places we do show one. */
export function priceLabel(price: number): string {
  return price > 0 ? `${formatNumber(price)} ₸` : "Бесплатно";
}
