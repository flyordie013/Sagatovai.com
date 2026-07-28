import { BookOpen } from "lucide-react";
import type { CourseSummary } from "@/types";
import { CourseCard } from "./course-card";

export function CourseGrid({ courses }: { courses: CourseSummary[] }) {
  if (courses.length === 0) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
        <div className="mb-3 grid size-12 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <BookOpen className="size-6" strokeWidth={1.8} />
        </div>
        <p className="font-display text-lg font-bold">Пока нет курсов</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Как только вам откроют доступ к курсу, он появится здесь. Загляните позже
          или напишите менеджеру.
        </p>
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
