import type { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Bot,
  Code2,
  Clock,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import type { CourseIcon } from "@/types";
import { getPublicCourse } from "@/data/public";
import { Badge } from "@/components/ui/badge";
import { pluralize } from "@/lib/utils";
import { LeadForm } from "../../lead-form";
import { RichText } from "@/components/ui/rich-text";
import { priceLabel } from "../../public-course-card";

const ICONS: Record<CourseIcon, LucideIcon> = { sparkles: Sparkles, bot: Bot, code: Code2 };

/**
 * Course links are often forwarded, so the preview has to
 * be about THIS course. Metadata is merged shallowly per key: declaring
 * `openGraph` here replaces the root layout's object whole, which is why the
 * card fields are restated. The preview image is the one exception — it comes
 * from the file convention (app/opengraph-image.tsx) merged into the parent
 * segment, so it has to be carried over from `parent` explicitly, otherwise
 * this page would ship a card with no picture. `twitter` follows the same
 * replace-whole rule; its image is auto-filled from openGraph.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) return { title: "Курс не найден" };

  const url = `/courses/${course.slug}`;
  const images = (await parent).openGraph?.images ?? [];

  return {
    title: course.title,
    description: course.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "OQU",
      locale: "ru_RU",
      url,
      title: course.title,
      description: course.description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: course.title,
      description: course.description,
    },
  };
}

export default async function PublicCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getPublicCourse(slug);
  if (!course) notFound();
  const Icon = ICONS[course.icon] ?? Sparkles;
  const facts = [
    ["Что вы научитесь делать", course.outcomes],
    ["Кому подходит", course.audience],
    ["Что понадобится", course.requirements],
    ["Что входит в обучение", course.included],
  ].filter(([, value]) => value.trim());

  return <div className="mx-auto max-w-[1180px] px-4 py-9 sm:px-6 sm:py-14">
    <Link href="/courses" className="inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" /> Все курсы</Link>
    <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-2"><Icon className="size-4" /> Практический курс / OQU</p>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">{course.title}</h1>
        {course.description && <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">{course.description}</p>}
        <div className="mt-6 flex flex-wrap gap-5 text-sm text-muted"><span className="inline-flex items-center gap-2"><PlayCircle className="size-4" />{course.lessonCount} {pluralize(course.lessonCount, ["урок", "урока", "уроков"])}</span>{course.weeks > 0 && <span className="inline-flex items-center gap-2"><Clock className="size-4" />{course.weeks} {pluralize(course.weeks, ["неделя", "недели", "недель"])}</span>}<span>Все уроки доступны сразу после покупки</span></div>
        {course.flagship && <div className="mt-4"><Badge variant="gold">Основная программа</Badge></div>}
        <Link href="#zayavka" className="btn-primary mt-7 lg:hidden">Обсудить обучение <ArrowRight className="size-4" /></Link>
        {facts.map(([title, text]) => <section key={title} className="mt-10 border-t border-line pt-8"><h2 className="text-xl font-semibold">{title}</h2><RichText text={text} className="mt-4 text-muted" /></section>)}
        <section className="mt-12 border-t border-line pt-8">
          <p className="eyebrow mb-3">Темы и уроки</p><h2 className="text-2xl font-semibold">Программа курса</h2>
          <p className="mt-2 text-sm text-muted">Порядок обучения выбираете вы. Можно вернуться к любой теме.</p>
          <div className="mt-6 divide-y divide-line-strong border-y border-line-strong">
            {course.modules.map((m, i) => <details key={m.id} open={i === 0} className="py-5"><summary className="cursor-pointer text-base font-semibold"><span className="mr-3 font-mono text-xs text-gold">{String(i + 1).padStart(2, "0")}</span>{m.title}<span className="ml-3 text-xs font-normal text-muted">{m.lessons.length} {pluralize(m.lessons.length, ["урок", "урока", "уроков"])}</span></summary><ul className="mt-4 space-y-3 pl-7">{m.lessons.map((l) => <li key={l.id} className="flex gap-3 text-sm text-muted"><PlayCircle className="mt-0.5 size-4 shrink-0" /><span>{l.title}</span></li>)}</ul></details>)}
          </div>
        </section>
        {course.authorName && course.authorBio && <section className="mt-10 border-t border-line pt-8"><p className="eyebrow">Автор курса</p><h2 className="mt-3 text-2xl font-semibold">{course.authorName}</h2><RichText text={course.authorBio} className="mt-4 text-muted" /></section>}
        <section className="mt-10 border-t border-line pt-8"><h2 className="text-xl font-semibold">Доступ и условия</h2>{course.accessTerms ? <RichText text={course.accessTerms} className="mt-4 text-muted" /> : <p className="mt-3 text-sm leading-relaxed text-muted">Уточните срок доступа, нужные сервисы и формат поддержки перед оплатой. Оставьте заявку — обсудим условия этого курса.</p>}<p className="mt-3 text-sm text-muted">Доступ открывает администратор после подтверждения оплаты. Регистрация и заявка не заменяют покупку.</p></section>
      </div>
      <aside id="zayavka" className="scroll-mt-24 rounded-2xl border border-line-strong bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
        <p className="eyebrow">Ваш следующий шаг</p><p className="mt-4 text-2xl font-semibold">{priceLabel(course.price)}</p>
        <h2 className="mt-5 text-lg font-semibold">Обсудить обучение</h2><p className="mt-2 mb-5 text-sm leading-relaxed text-muted">Уточним, подходит ли курс под вашу задачу, расскажем об оплате и доступе.</p>
        <LeadForm courseId={course.id} courseTitle={course.title} />
      </aside>
    </div>
  </div>;
}
