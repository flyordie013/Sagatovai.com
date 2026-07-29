import Link from "next/link";
import { BookOpen, ArrowRight, MessageCircle } from "lucide-react";
import type { CourseSummary } from "@/types";
import { CourseCard } from "./course-card";

// Same number as the course page's request block (app/(app)/course/[slug]).
const WHATSAPP = "https://wa.me/77073330241";

export function CourseGrid({ courses }: { courses: CourseSummary[] }) {
  if (courses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
        <div className="mb-3 grid size-12 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <BookOpen className="size-6" strokeWidth={1.8} />
        </div>
        <p className="font-display text-lg font-bold">Пока нет курсов</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Как только вам откроют доступ к курсу, он появится здесь. А пока —
          посмотрите каталог или напишите нам.
        </p>
        {/* An empty account is the student's first screen: give it somewhere to
            go instead of ending on «напишите менеджеру» with no contact. */}
        <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/courses"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
          >
            Смотреть каталог
            <ArrowRight className="size-4" />
          </Link>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
          >
            <MessageCircle className="size-4" />
            Написать в WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
