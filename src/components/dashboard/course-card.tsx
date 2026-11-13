import Link from "next/link";
import {
  Sparkles,
  Bot,
  Code2,
  Clock,
  PlayCircle,
  Lock,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { CourseIcon, CourseSummary } from "@/types";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn, pluralize } from "@/lib/utils";

const ICONS: Record<CourseIcon, LucideIcon> = {
  sparkles: Sparkles,
  bot: Bot,
  code: Code2,
};

export function CourseCard({ course }: { course: CourseSummary }) {
  const locked = course.access === "locked";
  const done = course.progress >= 100 && course.lessons > 0;
  const Icon = ICONS[course.icon];

  return (
    <article className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card ring-inset-hair transition duration-300 ease-[var(--ease-soft)] hover:border-line-strong">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid size-12 place-items-center rounded-xl border",
            locked
              ? "border-line-strong bg-white/5 text-muted"
              : "border-gold/25 bg-gold/10 text-gold",
          )}
        >
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
        {course.flagship && (
          <Badge variant="gold">
            {/* Padlock only when it's actually locked — showing it on a course
                the student already owns reads as "still not yours". */}
            {locked && <Lock className="size-3" />}
            Флагман
          </Badge>
        )}
      </div>

      <h3 className="font-display text-lg font-bold leading-snug">{course.title}</h3>
      <p className="mt-1.5 text-sm text-muted">{course.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted">
        {course.weeks > 0 && <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {course.weeks} {pluralize(course.weeks, ["неделя", "недели", "недель"])}
        </span>}
        <span className="inline-flex items-center gap-1.5">
          <PlayCircle className="size-3.5" />
          {course.lessons} {pluralize(course.lessons, ["урок", "урока", "уроков"])}
        </span>
      </div>

      <div className="mt-4">
        {locked ? (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">Доступ</span>
            <span className="font-medium text-text">По заявке</span>
          </div>
        ) : (
          <>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted">Прогресс</span>
              <span className="nums font-medium text-text">{course.progress}%</span>
            </div>
            <ProgressBar
              value={course.progress}
              aria-label={`Прогресс курса ${course.title}`}
            />
          </>
        )}
      </div>

      <Link
        href={`/course/${course.slug}`}
        className={cn(
          "mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
          locked
            ? "border border-line-strong bg-raised text-text hover:bg-raised-2"
            : "bg-gold text-gold-ink shadow-glow hover:bg-gold-soft",
        )}
      >
        {locked ? (
          <>
            <Lock className="size-4" />
            О курсе
          </>
        ) : done ? (
          <>
            <CheckCircle2 className="size-4" />
            Пройден — повторить
          </>
        ) : (
          <>
            Открыть курс
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Link>
    </article>
  );
}
