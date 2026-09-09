import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { requireUser, isStaff } from "@/lib/session";
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

  const { userId, role } = await requireUser();
  const data = await getLessonForStudent(lessonId, userId, isStaff(role));
  if (!data) notFound();

  const { lesson, moduleTitle, course, canView, completed, watchedPct, position, total, prevLessonId, nextLessonId } = data;

  // Students without admin-granted access return to the course request screen.
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
        // Fallback length for files that carry none in their header (screen
        // recordings report Infinity) — without it the watch % never moves.
        durationHint={lesson.videoDurationSec}
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
