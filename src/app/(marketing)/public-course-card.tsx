import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicCourse } from "@/data/public";
import { formatNumber, pluralize } from "@/lib/utils";

export function PublicCourseCard({ course, index = 0 }: { course: PublicCourse; index?: number }) {
  const result = course.outcomes.split("\n").find((line) => line.trim())?.replace(/^[-•*]\s*/, "");
  return <article className="group flex flex-col rounded-2xl border border-line-strong bg-surface p-6 sm:p-8">
    <div className="flex items-center justify-between gap-3"><span className="font-mono text-xs text-muted">ПРОГРАММА / {String(index + 1).padStart(2, "0")}</span>{course.flagship && <span className="text-xs text-gold">Основной курс</span>}</div>
    <h3 className="mt-7 text-2xl font-semibold leading-tight tracking-tight"><Link href={`/courses/${course.slug}`} className="hover:text-gold">{course.title}</Link></h3>
    <p className="mt-3 text-sm leading-relaxed text-muted">{result || course.description}</p>
    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted"><span>{course.lessonCount} {pluralize(course.lessonCount, ["урок", "урока", "уроков"])}</span>{course.weeks > 0 && <span>{course.weeks} {pluralize(course.weeks, ["неделя", "недели", "недель"])}</span>}<span>В своём темпе</span></div>
    <div className="mt-auto pt-7"><div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-strong pt-5"><p className="text-base font-semibold">{priceLabel(course.price)}</p><Link href={`/courses/${course.slug}`} className="btn-secondary">О курсе <ArrowRight className="size-4" /></Link></div></div>
  </article>;
}
export function CoursesEmptyState({ homeLink = true }: { homeLink?: boolean }) {
  return <div className="rounded-2xl border border-line p-8"><h3 className="text-xl font-semibold">Готовим новые программы</h3><p className="mt-3 max-w-lg text-sm text-muted">Оставьте контакт и расскажите, что хотите изучить. Сообщим о подходящем курсе.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/#zayavka" className="btn-primary">Оставить заявку</Link>{homeLink && <Link href="/" className="btn-secondary">На главную</Link>}</div></div>;
}
export function priceLabel(price: number): string { return price > 0 ? `${formatNumber(price)} ₸` : "Стоимость по запросу"; }
