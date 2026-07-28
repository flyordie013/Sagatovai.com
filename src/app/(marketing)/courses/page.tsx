import { listPublicCourses } from "@/data/public";
import { PublicCourseCard } from "../public-course-card";

export const metadata = {
  title: "Курсы",
  description:
    "Практические курсы по искусственному интеллекту на русском языке — от нейросетей для контента до автоматизации продаж и разработки с AI.",
};

export default async function PublicCoursesPage() {
  const courses = await listPublicCourses();

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6 sm:py-20">
      <header className="mb-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
          Каталог
        </p>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Курсы</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">
          Выберите направление — каждый курс заканчивается собранным проектом, а не
          сертификатом «о прослушивании».
        </p>
      </header>

      {courses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-sm text-muted">
          Курсы скоро появятся.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <PublicCourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
