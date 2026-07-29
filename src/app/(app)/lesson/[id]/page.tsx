import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Bot, FileText } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/ui/rich-text";

export const metadata = { title: "Урок" };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId)) notFound();

  const { userId } = await requireUser();
  const data = await getLessonForStudent(lessonId, userId);
  if (!data) notFound();

  const { lesson, moduleTitle, course, canView, unlocked, completed, watchedPct, position, total, prevLessonId, nextLessonId } = data;

  // Not a free preview and the course isn't bought → back to the course page,
  // which shows the free lessons plus the purchase CTA.
  if (!canView) redirect(`/course/${course.slug}`);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={`/course/${course.slug}`}
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        {course.title}
      </Link>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
          {moduleTitle} · Урок {position} из {total}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold sm:text-3xl">
          {lesson.title}
        </h1>
        {lesson.description && (
          <p className="mt-2 text-sm text-muted">{lesson.description}</p>
        )}
      </div>

      {!unlocked ? (
        <Card className="p-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl border border-line-strong bg-white/5 text-muted">
            <Lock className="size-6" />
          </div>
          <h2 className="mt-3 font-display text-lg font-bold">Урок заблокирован</h2>
          <p className="mt-1 text-sm text-muted">
            Сначала завершите предыдущий урок.
          </p>
          {prevLessonId && (
            <Link
              href={`/lesson/${prevLessonId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
            >
              <ArrowLeft className="size-4" />
              К предыдущему уроку
            </Link>
          )}
        </Card>
      ) : (
        <>
          <LessonPlayer
            lessonId={lesson.id}
            // Uploaded video streams through the access-checked route; an
            // external link (legacy) is used as-is.
            videoUrl={lesson.videoKey ? `/api/lessons/${lesson.id}/video` : lesson.videoUrl}
            initialWatchedPct={watchedPct}
            initialCompleted={completed}
            nextLessonId={nextLessonId}
            resumeAt={
              completed || !lesson.videoDurationSec
                ? 0
                : Math.floor((watchedPct / 100) * lesson.videoDurationSec)
            }
            courseSlug={course.slug}
          />

          {lesson.content && (
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
                <FileText className="size-3.5" />
                Материалы урока
              </p>
              <RichText text={lesson.content} className="text-muted" />
            </Card>
          )}

          {/* contextual AI mentor */}
          <Card className="flex items-center gap-3 p-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
              <Bot className="size-5" strokeWidth={1.8} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Не понятно? Спросите AI-наставника</p>
              <p className="text-xs text-muted">Объяснит тему урока простыми словами</p>
            </div>
            <Link
              href="/mentor"
              className="shrink-0 rounded-xl border border-line-strong bg-raised px-3 py-2 text-xs font-semibold text-text transition-colors hover:bg-raised-2"
            >
              Спросить
            </Link>
          </Card>
        </>
      )}

      {/* prev / next */}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        {prevLessonId ? (
          <Link
            href={`/lesson/${prevLessonId}`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
          >
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        ) : (
          <span />
        )}
        {nextLessonId ? (
          <Link
            href={`/lesson/${nextLessonId}`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
          >
            Далее
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
