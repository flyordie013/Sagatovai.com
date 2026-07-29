import Link from "next/link";
import {
  Sparkles,
  Bot,
  Code2,
  Plus,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { listCourses } from "@/data/admin";
import { createCourse, moveCourse } from "../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  SubmitButton,
} from "@/components/admin/form";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Курсы" };

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  bot: Bot,
  code: Code2,
};

export default async function AdminCoursesPage() {
  const courses = await listCourses();

  return (
    <div className="mx-auto max-w-[1100px] space-y-10">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Курсы</h2>
            <p className="mt-1.5 text-sm text-muted">
              {courses.length} {pluralize(courses.length, ["курс", "курса", "курсов"])} на платформе
              {courses.length > 1 ? " · стрелками задайте порядок на витрине" : ""}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {courses.map((c, i) => {
            const Icon = ICONS[c.icon] ?? Sparkles;
            return (
              // The move buttons are forms, so they live OUTSIDE the row link —
              // nesting them inside would make every click navigate instead.
              <Card
                key={c.id}
                className="flex items-center gap-3 p-4 transition-colors hover:border-line-strong"
              >
                <Link
                  href={`/admin/courses/${c.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-4"
                >
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                    <Icon className="size-5" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.title}</p>
                      {c.flagship && <Badge variant="gold">Флагман</Badge>}
                      {c.isArchived ? (
                        <Badge variant="danger">В архиве</Badge>
                      ) : (
                        <Badge variant={c.isPublished ? "teal" : "neutral"}>
                          {c.isPublished ? "Опубликован" : "Черновик"}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted">
                      /{c.slug} · {c.modules} мод. · {c.lessons} ур. · {c.students} студ.
                      {c.price > 0 ? ` · ${formatNumber(c.price)} ₸` : " · бесплатно"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
                </Link>
                <div className="flex shrink-0 items-center gap-1.5">
                  {[
                    { dir: "up", Icon: ChevronUp, disabled: i === 0, label: "выше" },
                    {
                      dir: "down",
                      Icon: ChevronDown,
                      disabled: i === courses.length - 1,
                      label: "ниже",
                    },
                  ].map(({ dir, Icon: Arrow, disabled, label }) => (
                    <form key={dir} action={moveCourse}>
                      <input type="hidden" name="courseId" value={c.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button
                        type="submit"
                        disabled={disabled}
                        aria-label={`Переместить курс ${label}`}
                        className="grid size-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Arrow className="size-4" />
                      </button>
                    </form>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Plus className="size-5 text-gold" />
          <h3 className="font-display text-lg font-bold">Новый курс</h3>
        </div>
        <Card className="p-5 sm:p-6">
          <form action={createCourse} className="grid gap-4 sm:grid-cols-2">
            <Field label="Название">
              <TextInput name="title" required placeholder="Напр. AI-дизайн" />
            </Field>
            <Field label="Slug (URL)" hint="латиницей; можно оставить пустым">
              <TextInput name="slug" placeholder="ai-design" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Описание">
                <TextArea name="description" placeholder="Краткое описание курса для карточки" />
              </Field>
            </div>
            <Field label="Иконка">
              <Select name="icon" defaultValue="sparkles">
                <option value="sparkles">✦ Sparkles</option>
                <option value="bot">🤖 Bot</option>
                <option value="code">{"</> Code"}</option>
              </Select>
            </Field>
            <Field label="Длительность (недель)">
              <TextInput name="weeks" type="number" min="0" defaultValue="4" />
            </Field>
            <Field label="Цена (₸)" hint="пусто или 0 = бесплатный курс">
              <TextInput name="price" type="number" min="0" step="1000" placeholder="150000" />
            </Field>
            <div className="flex items-end gap-6">
              <Checkbox name="flagship" value="true" label="Флагман" />
            </div>
            <div className="sm:col-span-2 space-y-3">
              <p className="rounded-xl border border-line bg-raised/50 px-3.5 py-2.5 text-xs text-muted">
                Курс создаётся <strong className="text-text">черновиком</strong>: студенты его не
                видят. Опубликуете на странице курса, когда добавите хотя бы один урок и
                проставите цену — иначе бесплатный пустой курс автоматически откроется всем
                новым студентам навсегда.
              </p>
              <SubmitButton pendingLabel="Создание…">Создать курс</SubmitButton>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
