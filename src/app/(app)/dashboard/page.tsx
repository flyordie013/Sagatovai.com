import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { getDashboard } from "@/data/dashboard";
import { CourseGrid } from "@/components/dashboard/course-grid";
import { pluralize } from "@/lib/utils";

export default async function DashboardPage() {
  const data = await getDashboard();
  const owned = data.courses.filter(c => c.access === "full");
  const catalog = data.courses.filter(c => c.access !== "full");
  return (
    <div className="mx-auto max-w-[1180px] space-y-10">
      <header>
        <p className="eyebrow">Личный кабинет</p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Мои курсы</h1>
        <p className="mt-3 max-w-2xl text-muted">Учитесь в своём темпе. Уроки доступны в любом порядке, а отметки о прохождении — для вашего удобства.</p>
      </header>
      {data.resume && <section className="flex flex-col justify-between gap-6 rounded-2xl border border-gold/25 bg-surface p-6 sm:flex-row sm:items-center sm:p-8" aria-label="Продолжить обучение">
        <div><p className="eyebrow">Вы остановились здесь</p><h2 className="mt-3 text-xl font-semibold">{data.resume.title}</h2><p className="mt-2 text-sm text-muted">{data.resume.courseTitle}</p></div>
        <Link href={`/lesson/${data.resume.id}`} className="btn-primary shrink-0"><Play className="size-4" />Продолжить урок</Link>
      </section>}
      <section aria-label="Курсы с доступом">
        {owned.length > 0 && <p className="mb-5 text-sm text-muted">Завершено {data.completedLessons} из {data.totalLessons} уроков · {owned.length} {pluralize(owned.length, ["курс", "курса", "курсов"])} с доступом</p>}
        <CourseGrid courses={owned} />
      </section>
      {catalog.length > 0 && <section className="border-t border-line pt-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl font-bold">Другие программы</h2><p className="mt-2 text-sm text-muted">Выберите курс. Администратор откроет доступ после оплаты.</p></div><Link href="/courses" className="btn-secondary">Весь каталог<ArrowRight className="size-4" /></Link></div>
        <CourseGrid courses={catalog} />
      </section>}
      <div className="flex flex-wrap gap-6 border-t border-line pt-6 text-sm text-muted"><Link href="/achievements" className="hover:text-gold">Мои достижения</Link><Link href="/leaderboard" className="hover:text-gold">Рейтинг участников</Link><Link href="/profile" className="hover:text-gold">Настройки профиля</Link></div>
    </div>
  );
}
