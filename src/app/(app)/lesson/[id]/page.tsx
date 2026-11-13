import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { requireUser, isStaff } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { LessonPlayer } from "@/components/lesson/lesson-player";
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/ui/rich-text";
import { listLessonMaterials } from "@/data/materials";
import { MaterialList } from "@/components/lesson/material-list";

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
  const files = await listLessonMaterials(lesson.id);

  return (
    <div className="mx-auto max-w-[1320px] lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8">
    <div className="min-w-0 space-y-5">
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

      <Link href="#curriculum" className="btn-secondary lg:hidden">Все уроки курса ↓</Link>
      <LessonPlayer
        key={lesson.id}
        lessonId={lesson.id}
        // Uploaded video streams through the access-checked route; an
        // external link (legacy) is used as-is.
        videoUrl={lesson.videoKey ? `/api/lessons/${lesson.id}/video` : lesson.videoUrl}
        initialWatchedPct={watchedPct}
        initialCompleted={completed}
        nextLessonId={nextLessonId}
        resumeAt={data.lastPositionSec}
        // Fallback length for files that carry none in their header (screen
        // recordings report Infinity) — without it the watch % never moves.
        durationHint={lesson.videoDurationSec}
        courseSlug={course.slug}
      />

      <MaterialList files={files} />
      {lesson.content && (
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            <FileText className="size-3.5" />
            Конспект урока
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
            Предыдущий урок
          </Link>
        ) : (
          <span />
        )}
        {nextLessonId ? (
          <Link
            href={`/lesson/${nextLessonId}`}
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
          >
            Следующий урок
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
      </div>
      <aside id="curriculum" className="scroll-mt-24 mt-6 rounded-2xl border border-line bg-surface lg:sticky lg:top-24 lg:mt-0">
        <details open className="p-4">
          <summary className="cursor-pointer font-semibold">Уроки курса <span className="ml-2 text-sm font-normal text-muted">{total}</span></summary>
          <p className="mt-2 text-xs text-muted">Можно смотреть в любом порядке</p>
          <ol className="mt-4 space-y-1 lg:max-h-[65vh] lg:overflow-y-auto">
            {data.curriculum.map((item, i) => <li key={item.id}><Link href={`/lesson/${item.id}`} aria-current={item.id === lesson.id ? "page" : undefined} className={`flex items-start gap-3 rounded-lg p-3 text-sm ${item.id === lesson.id ? "bg-gold/10 text-gold" : "text-muted hover:bg-raised hover:text-text"}`}><span className="shrink-0 font-mono text-xs">{String(i + 1).padStart(2, "0")}</span><span className="break-words">{item.title}</span></Link></li>)}
          </ol>
        </details>
      </aside>
    </div>
  );
}
