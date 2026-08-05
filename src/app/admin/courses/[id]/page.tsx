import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Video,
  FileText,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { getCourseForAdmin } from "@/data/admin";
import {
  updateCourse,
  togglePublish,
  deleteCourse,
  restoreCourse,
  createModule,
  updateModule,
  moveModule,
  deleteModule,
  createLesson,
  updateLesson,
  moveLesson,
  deleteLesson,
} from "../../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  SubmitButton,
  ConfirmSubmit,
} from "@/components/admin/form";
import { VideoUpload } from "@/components/admin/video-upload";
import { RichText } from "@/components/ui/rich-text";
import { pluralize } from "@/lib/utils";

export const metadata = { title: "Редактирование курса" };

function fmtDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  return `${m} мин`;
}

export default async function AdminCourseDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const courseId = Number(id);
  const data = await getCourseForAdmin(courseId);
  if (!data) notFound();

  const { course, modules } = data;
  const lessonTotal = modules.reduce((n, m) => n + m.lessons.length, 0);
  // An empty course must not reach the storefront — publishing is blocked in
  // the action too, this only explains why the button is off.
  const canPublish = lessonTotal > 0;

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <Link
        href="/admin/courses"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        К списку курсов
      </Link>

      {error === "no-lessons" && (
        <Card className="flex gap-3 border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm leading-relaxed text-text">
            Курс не опубликован: в нём нет ни одного урока. Добавьте хотя бы один урок —
            иначе студенты увидят на витрине пустую карточку, а бесплатный курс ещё и
            автоматически откроется каждому новому студенту навсегда.
          </p>
        </Card>
      )}

      {error === "video-url" && (
        <Card className="flex gap-3 border-danger/30 bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm leading-relaxed text-text">
            Ссылка на видео не сохранена: ссылки на YouTube, Vimeo и Google Drive не
            поддерживаются — загрузите файл на платформу. Плеер играет только прямые
            файлы (.mp4, .webm), по ссылке на страницу видеохостинга студент увидит
            чёрный прямоугольник. Остальные изменения урока сохранены.
          </p>
        </Card>
      )}

      {/* ---- header + settings ---- */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold">{course.title}</h2>
              {course.isArchived ? (
                <Badge variant="danger">В архиве</Badge>
              ) : (
                <Badge variant={course.isPublished ? "teal" : "neutral"}>
                  {course.isPublished ? "Опубликован" : "Черновик"}
                </Badge>
              )}
              {course.flagship && <Badge variant="gold">Флагман</Badge>}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">
              /{course.slug} · {modules.length}{" "}
              {pluralize(modules.length, ["модуль", "модуля", "модулей"])} · {lessonTotal}{" "}
              {pluralize(lessonTotal, ["урок", "урока", "уроков"])}
            </p>
          </div>
          {course.isArchived ? (
            <form action={restoreCourse}>
              <input type="hidden" name="courseId" value={course.id} />
              <SubmitButton>Вернуть из архива</SubmitButton>
            </form>
          ) : !course.isPublished && !canPublish ? (
            <div className="max-w-64 text-right">
              <span className="inline-flex cursor-not-allowed items-center rounded-xl border border-line-strong bg-raised-2 px-4 py-2.5 text-sm font-semibold text-faint">
                Опубликовать
              </span>
              <p className="mt-1.5 text-xs text-faint">
                Сначала добавьте хотя бы один урок.
              </p>
            </div>
          ) : (
            <form action={togglePublish}>
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="next" value={course.isPublished ? "false" : "true"} />
              <SubmitButton
                className={
                  course.isPublished
                    ? "bg-raised-2 text-text shadow-none hover:bg-raised"
                    : ""
                }
              >
                {course.isPublished ? "Снять с публикации" : "Опубликовать"}
              </SubmitButton>
            </form>
          )}
        </div>

        <details className="mt-5 border-t border-line pt-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-muted transition-colors hover:text-text">
            Настройки курса
          </summary>
          <form action={updateCourse} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <Field label="Название">
              <TextInput name="title" defaultValue={course.title} required />
            </Field>
            <Field label="Иконка">
              <Select name="icon" defaultValue={course.icon}>
                <option value="sparkles">✦ Sparkles</option>
                <option value="bot">🤖 Bot</option>
                <option value="code">{"</> Code"}</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Адрес курса (slug)"
                hint="латиница/цифры/дефис — часть ссылки /courses/…"
              >
                <TextInput name="slug" defaultValue={course.slug} placeholder="ai-manager" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Описание">
                <TextArea name="description" defaultValue={course.description} />
              </Field>
            </div>
            <Field label="Длительность (недель)">
              <TextInput name="weeks" type="number" min="0" defaultValue={course.weeks} />
            </Field>
            <Field label="Цена (₸)" hint="0 = бесплатно">
              <TextInput name="price" type="number" min="0" step="1000" defaultValue={course.price} />
            </Field>
            {/* Empty field = no rating: the storefront hides the star at 0
                rather than showing «★ 0». */}
            <Field label="Рейтинг" hint="от 0 до 5, пусто — без звёздочки">
              <TextInput
                name="rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                placeholder="4.8"
                defaultValue={course.rating > 0 ? course.rating : ""}
              />
            </Field>
            <div className="flex items-end gap-6">
              <Checkbox name="flagship" value="true" label="Флагман" defaultChecked={course.flagship} />
              <Checkbox
                name="isPublished"
                value="true"
                label="Опубликован"
                defaultChecked={course.isPublished}
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Сохранить настройки</SubmitButton>
            </div>
          </form>
          <form action={deleteCourse} className="mt-4 border-t border-line pt-4">
            <input type="hidden" name="courseId" value={course.id} />
            <ConfirmSubmit
              triggerClassName="inline-flex items-center gap-1.5 text-xs text-danger transition-colors hover:underline"
              confirmLabel="Удалить курс"
              prompt="Удалить курс? Если по нему были продажи — он уйдёт в архив (история платежей сохранится)."
            >
              <Trash2 className="size-3.5" />
              Удалить курс со всем содержимым
            </ConfirmSubmit>
            <p className="mt-2 text-xs text-faint">
              Курс с оплатами не удаляется, а архивируется — чтобы не потерять историю
              платежей и выручку.
            </p>
          </form>
        </details>
      </Card>

      {/* ---- modules & lessons ---- */}
      <div className="space-y-4">
        <h3 className="font-display text-lg font-bold">Модули и уроки</h3>

        {modules.length === 0 && (
          <p className="text-sm text-muted">Пока нет модулей — добавьте первый ниже.</p>
        )}

        {modules.map((m, i) => (
          <Card key={m.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form action={updateModule} className="flex min-w-0 flex-1 items-center gap-2">
                <input type="hidden" name="moduleId" value={m.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <span className="shrink-0 font-mono text-xs text-faint">Модуль {i + 1}</span>
                <TextInput
                  name="title"
                  defaultValue={m.title}
                  aria-label="Название модуля"
                  className="min-w-0 flex-1 font-semibold"
                />
                <span className="hidden shrink-0 text-xs text-muted sm:inline">
                  {m.lessons.length} {pluralize(m.lessons.length, ["урок", "урока", "уроков"])}
                </span>
                <SubmitButton className="shrink-0 px-3 py-2" pendingLabel="…">
                  Сохранить
                </SubmitButton>
              </form>
              <div className="flex shrink-0 items-center gap-1.5">
                {[
                  { dir: "up", Icon: ChevronUp, disabled: i === 0, label: "Выше" },
                  { dir: "down", Icon: ChevronDown, disabled: i === modules.length - 1, label: "Ниже" },
                ].map(({ dir, Icon, disabled, label }) => (
                  <form key={dir} action={moveModule}>
                    <input type="hidden" name="moduleId" value={m.id} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="dir" value={dir} />
                    <button
                      type="submit"
                      disabled={disabled}
                      aria-label={`Переместить модуль ${label}`}
                      className="grid size-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-line-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Icon className="size-4" />
                    </button>
                  </form>
                ))}
                <form action={deleteModule}>
                  <input type="hidden" name="moduleId" value={m.id} />
                  <input type="hidden" name="courseId" value={course.id} />
                  <ConfirmSubmit
                    aria-label="Удалить модуль"
                    triggerClassName="grid size-8 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                    confirmLabel="Удалить"
                    prompt="Точно?"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmSubmit>
                </form>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {m.lessons.map((l, li) => (
                <details
                  key={l.id}
                  className="overflow-hidden rounded-xl border border-line bg-raised/40"
                >
                  <summary className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-3 text-sm">
                    <span className="shrink-0 font-mono text-xs text-faint">{li + 1}.</span>
                    <Video className="size-4 shrink-0 text-gold" />
                    <span className="min-w-0 truncate font-medium">{l.title}</span>
                    {l.isFree && (
                      <span className="shrink-0 rounded-md border border-teal/30 bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal">
                        Бесплатно
                      </span>
                    )}
                    {!l.videoUrl && !l.videoKey && (
                      <span className="shrink-0 rounded-md border border-line-strong bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
                        Нет видео
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-mono text-xs text-faint">
                      {fmtDuration(l.videoDurationSec)}
                    </span>
                  </summary>
                  <div className="border-t border-line p-4">
                    {/* Upload lives outside the settings form: it streams to its
                        own route, so it must not be submitted with the form. */}
                    <div className="mb-4">
                      <VideoUpload
                        lessonId={l.id}
                        hasVideo={Boolean(l.videoKey)}
                        sizeBytes={l.videoSizeBytes}
                      />
                    </div>
                    <form action={updateLesson} className="grid gap-4">
                      <input type="hidden" name="lessonId" value={l.id} />
                      <input type="hidden" name="courseId" value={course.id} />
                      <Field label="Название урока">
                        <TextInput name="title" defaultValue={l.title} required />
                      </Field>
                      <Field label="Короткое описание">
                        <TextInput name="description" defaultValue={l.description} placeholder="Одна строка для превью урока" />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                        <div>
                          <Field
                            label="Ссылка на видео"
                            hint="если видео не загружено на платформу"
                          >
                            <TextInput
                              name="videoUrl"
                              defaultValue={l.videoUrl ?? ""}
                              placeholder="https://…/lesson.mp4"
                              disabled={Boolean(l.videoKey)}
                            />
                          </Field>
                          <p className="mt-1.5 text-xs text-faint">
                            Только прямая ссылка на файл (.mp4, .webm). Ссылки на YouTube,
                            Vimeo и Google Drive плеер не проигрывает — такое видео
                            загрузите на платформу кнопкой выше.
                          </p>
                        </div>
                        <Field label="Длительность (сек)">
                          <TextInput
                            name="videoDurationSec"
                            type="number"
                            min="0"
                            defaultValue={l.videoDurationSec}
                          />
                        </Field>
                      </div>
                      <Field
                        label="Содержание урока"
                        hint="пустая строка — новый абзац, «- » — пункт списка, ссылки вставляйте целиком"
                      >
                        <TextArea name="content" defaultValue={l.content} className="min-h-32" />
                      </Field>
                      {/* Preview of what's SAVED — the owner types plain text and
                          needs to see that the links/lists actually took. */}
                      {l.content && (
                        <details className="rounded-xl border border-line bg-raised/40 p-3.5">
                          <summary className="cursor-pointer select-none text-xs font-medium text-muted transition-colors hover:text-text">
                            Как это увидит студент
                          </summary>
                          <RichText text={l.content} className="mt-3 text-muted" />
                        </details>
                      )}
                      <div className="rounded-xl border border-line bg-raised/50 p-3.5">
                        <Checkbox
                          name="isFree"
                          defaultChecked={l.isFree}
                          label="Бесплатный урок — открыт всем зарегистрированным, без покупки"
                        />
                        <p className="mt-1.5 pl-6.5 text-xs text-faint">
                          Так делают вводные уроки: человек смотрит первые 1–2 урока, а
                          дальше видит предложение купить курс.
                        </p>
                      </div>
                      <div>
                        <SubmitButton>Сохранить урок</SubmitButton>
                      </div>
                    </form>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      {[
                        { dir: "up", Icon: ChevronUp, disabled: li === 0, label: "выше" },
                        { dir: "down", Icon: ChevronDown, disabled: li === m.lessons.length - 1, label: "ниже" },
                      ].map(({ dir, Icon, disabled, label }) => (
                        <form key={dir} action={moveLesson}>
                          <input type="hidden" name="lessonId" value={l.id} />
                          <input type="hidden" name="moduleId" value={m.id} />
                          <input type="hidden" name="courseId" value={course.id} />
                          <input type="hidden" name="dir" value={dir} />
                          <button
                            type="submit"
                            disabled={disabled}
                            aria-label={`Переместить урок ${label}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Icon className="size-3.5" />
                            {label}
                          </button>
                        </form>
                      ))}
                      <form action={deleteLesson} className="ml-auto">
                        <input type="hidden" name="lessonId" value={l.id} />
                        <input type="hidden" name="courseId" value={course.id} />
                        <ConfirmSubmit
                          triggerClassName="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-danger"
                          confirmLabel="Удалить урок"
                          prompt="Удалить урок?"
                        >
                          <Trash2 className="size-3.5" />
                          Удалить урок
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </div>
                </details>
              ))}
            </div>

            <form action={createLesson} className="mt-3 flex gap-2">
              <input type="hidden" name="moduleId" value={m.id} />
              <input type="hidden" name="courseId" value={course.id} />
              <TextInput name="title" placeholder="Название нового урока" required className="flex-1" />
              <SubmitButton pendingLabel="…" className="shrink-0">
                <Plus className="size-4" />
                Урок
              </SubmitButton>
            </form>
          </Card>
        ))}

        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="size-4 text-gold" />
            <p className="text-sm font-medium">Новый модуль</p>
          </div>
          <form action={createModule} className="flex gap-2">
            <input type="hidden" name="courseId" value={course.id} />
            <TextInput name="title" placeholder="Название модуля" required className="flex-1" />
            <SubmitButton className="shrink-0">
              <Plus className="size-4" />
              Модуль
            </SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}
