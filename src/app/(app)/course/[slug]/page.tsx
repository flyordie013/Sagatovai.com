import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  PlayCircle,
  CheckCircle2,
  Lock,
  Sparkles,
  Bot,
  Code2,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { requireUser, isStaff } from "@/lib/session";
import { getCourseForStudent, getNextCourseSuggestion } from "@/data/course";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn, formatNumber, pluralize } from "@/lib/utils";
import { RequestButton } from "../request-button";

export const metadata = { title: "Курс" };

const ICONS: Record<string, LucideIcon> = { sparkles: Sparkles, bot: Bot, code: Code2 };

export default async function CoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId, role } = await requireUser();
  const data = await getCourseForStudent(slug, userId, isStaff(role));
  if (!data) notFound();

  const { course, owns, requested, modules, totalLessons, completedLessons, nextLessonId, courseCompleted } =
    data;
  const Icon = ICONS[course.icon] ?? Sparkles;
  const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const locked = !owns;

  // Finishing a course used to end on a link to /achievements and nothing else.
  // Only queried in that state, so it costs nothing on every other visit.
  const nextCourse = courseCompleted
    ? await getNextCourseSuggestion(userId, course.id)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        К моим курсам
      </Link>

      {/* header */}
      <Card className="bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
            <Icon className="size-6" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-extrabold">{course.title}</h1>
            <p className="mt-1 text-sm text-muted">{course.description}</p>
          </div>
        </div>

        {owns && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-muted">
                Прогресс · {completedLessons}/{totalLessons}{" "}
                {pluralize(totalLessons, ["урок", "урока", "уроков"])}
              </span>
              <span className="nums font-medium text-text">{progress}%</span>
            </div>
            <ProgressBar value={progress} aria-label="Прогресс курса" />
            {nextLessonId && !courseCompleted ? (
              <Link
                href={`/lesson/${nextLessonId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
              >
                {completedLessons > 0 ? "Продолжить" : "Начать обучение"}
                <ArrowRight className="size-4" />
              </Link>
            ) : courseCompleted ? (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-teal/30 bg-teal/10 px-4 py-3">
                  <Trophy className="size-5 shrink-0 text-teal" />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-text">Курс пройден — поздравляем!</p>
                    <p className="text-sm text-muted">Все уроки завершены. Так держать 💪</p>
                  </div>
                  <Link
                    href="/achievements"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
                  >
                    Достижения
                    <ArrowRight className="size-4" />
                  </Link>
                </div>

                {/* Somewhere to go next — otherwise finishing a course is a dead end. */}
                {nextCourse && (
                  <div className="rounded-xl border border-gold/25 bg-gold/5 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
                      Что дальше
                    </p>
                    <p className="mt-1.5 font-display text-lg font-bold leading-snug">
                      {nextCourse.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {nextCourse.description}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Link
                        href={`/course/${nextCourse.slug}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
                      >
                        Посмотреть курс
                        <ArrowRight className="size-4" />
                      </Link>
                      <span className="nums font-mono text-sm font-bold text-gold">
                        {formatNumber(nextCourse.price)} ₸
                      </span>
                      {nextCourse.weeks > 0 && (
                        <span className="font-mono text-xs text-muted">
                          {nextCourse.weeks}{" "}
                          {pluralize(nextCourse.weeks, ["неделя", "недели", "недель"])}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {/* gated */}
      {locked ? (
        <Card className="p-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-line-strong bg-white/5 text-muted">
            <Lock className="size-6" />
          </div>
          <h2 className="mt-3 font-display text-lg font-bold">Доступ ещё не открыт</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            {requested
              ? "Заявка получена. Администратор проверит оплату и откроет доступ именно к этому курсу."
              : "Оставьте заявку. После проверки оплаты администратор вручную откроет доступ к этому курсу."}
          </p>
          {course.price > 0 && (
            <p className="nums mt-3 font-mono text-lg font-bold text-gold">
              {formatNumber(course.price)} ₸
            </p>
          )}
          <RequestButton courseId={course.id} alreadyRequested={requested} />
        </Card>
      ) : (
        /* modules & lessons */
        <div className="space-y-4">
          {totalLessons === 0 && (
            <Card className="grid place-items-center px-6 py-12 text-center">
              <PlayCircle className="mb-3 size-8 text-faint" />
              <p className="font-display font-bold">Уроки скоро появятся</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Курс ещё наполняется — загляните позже.
              </p>
            </Card>
          )}

          {modules.map((m, i) => (
            <Card key={m.id} className="p-5">
              <div className="mb-3 flex items-baseline gap-2">
                <span className="font-mono text-xs text-faint">Модуль {i + 1}</span>
                <h3 className="font-semibold">{m.title}</h3>
              </div>
              <ul className="space-y-1">
                {m.lessons.map((l) => {
                  const needsPurchase = !owns;
                  const inner = (
                    <>
                      {l.completed ? (
                        <CheckCircle2 className="size-5 shrink-0 text-teal" />
                      ) : l.playable ? (
                        <PlayCircle className="size-5 shrink-0 text-gold" />
                      ) : (
                        <Lock className="size-4 shrink-0 text-faint" />
                      )}
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          l.playable ? "text-text" : "text-faint",
                        )}
                      >
                        {l.title}
                      </span>
                      {needsPurchase && (
                        <span className="shrink-0 text-[11px] text-faint">после покупки</span>
                      )}
                      {l.playable && (
                        <ArrowRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                      )}
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {l.playable ? (
                        <Link
                          href={`/lesson/${l.id}`}
                          className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-line hover:bg-white/5"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3 px-3 py-2.5">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
