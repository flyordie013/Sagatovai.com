import { Target, Trophy, Gift, PackageCheck, Info, Trash2 } from "lucide-react";
import { getGamification } from "@/data/admin";
import {
  createMission,
  toggleMission,
  deleteMission,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  createStoreItem,
  deleteStoreItem,
  setRedemptionStatus,
} from "../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  ConfirmSubmit,
} from "@/components/admin/form";
import { formatDateTime } from "@/components/admin/format";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Геймификация" };

const CATEGORY_LABEL: Record<string, string> = {
  merch: "Мерч",
  guide: "Гайд",
  video: "Видео",
};

export default async function GamificationPage() {
  const { missions, achievements, items, redemptions } = await getGamification();
  const pending = redemptions.filter((r) => r.status === "pending");
  const allEmpty = missions.length === 0 && achievements.length === 0 && items.length === 0;

  return (
    <div className="mx-auto max-w-[900px] space-y-8">
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
          Мотивация
        </p>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Геймификация</h2>
        <p className="mt-1.5 text-sm text-muted">
          Цели, достижения и награды за XP.
          {allEmpty
            ? " Пока здесь пусто — у студентов эти разделы выглядят пустыми."
            : " Всё, что вы добавите, видят студенты."}
        </p>
      </header>

      <Card className="flex gap-3 border-gold/20 bg-gold/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" />
        <p className="text-sm leading-relaxed text-muted">
          Сейчас и цели, и достижения считаются по одному показателю —{" "}
          <strong className="text-text">количеству завершённых уроков</strong>. «Цель» с
          показателем 3 закроется после третьего пройденного урока и разово начислит XP.
        </p>
      </Card>

      {/* ---------------- выдача наград ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Запросы на награды</h3>
          {pending.length > 0 && <Badge variant="gold">{pending.length} ждут выдачи</Badge>}
        </div>

        {redemptions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-muted">
            Студенты ещё не забирали награды.
          </p>
        ) : (
          redemptions.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">{r.itemName}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {r.userName} ·{" "}
                  <a
                    href={`mailto:${r.userEmail}`}
                    className="font-mono text-xs text-gold underline-offset-2 hover:underline"
                  >
                    {r.userEmail}
                  </a>
                </p>
                <p className="mt-0.5 font-mono text-xs text-faint">
                  {CATEGORY_LABEL[r.category] ?? r.category} · {formatDateTime(r.createdAt)}
                </p>
                {r.note && (
                  <p className="mt-1.5 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs text-muted">
                    Доставка: {r.note}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.status === "pending" ? (
                  <>
                    <form action={setRedemptionStatus}>
                      <input type="hidden" name="redemptionId" value={r.id} />
                      <input type="hidden" name="next" value="fulfilled" />
                      <SubmitButton pendingLabel="…">Выдано</SubmitButton>
                    </form>
                    <form action={setRedemptionStatus}>
                      <input type="hidden" name="redemptionId" value={r.id} />
                      <input type="hidden" name="next" value="cancelled" />
                      <ConfirmSubmit
                        triggerClassName="text-xs text-muted transition-colors hover:text-danger"
                        confirmLabel="Отменить"
                        prompt="Отменить награду?"
                      >
                        Отменить
                      </ConfirmSubmit>
                    </form>
                  </>
                ) : (
                  <Badge variant={r.status === "fulfilled" ? "teal" : "neutral"}>
                    {r.status === "fulfilled" ? "Выдано" : "Отменено"}
                  </Badge>
                )}
              </div>
            </Card>
          ))
        )}
      </section>

      {/* ---------------- цели ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Цели студента</h3>
        </div>

        <Card className="p-5">
          <form action={createMission} className="grid gap-3 sm:grid-cols-2">
            <Field label="Название">
              <TextInput name="title" required placeholder="Первый шаг" />
            </Field>
            <Field label="Описание">
              <TextInput name="description" placeholder="Заверши свой первый урок" />
            </Field>
            <Field label="Сколько уроков нужно пройти">
              <TextInput name="target" type="number" min="1" defaultValue={1} />
            </Field>
            <Field label="Награда, XP">
              <TextInput name="xpReward" type="number" min="0" step="10" defaultValue={50} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Создаём…">Добавить цель</SubmitButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-faint">
            Новая цель сразу назначается всем студентам.
          </p>
        </Card>

        {missions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-muted">
            Целей нет — карточка «Текущая цель» у студентов пустая.
          </p>
        ) : (
          missions.map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{m.title}</p>
                  {!m.isActive && <Badge variant="neutral">Выключена</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-muted">{m.description}</p>
                <p className="mt-0.5 font-mono text-xs text-faint">
                  {m.target} уроков · +{formatNumber(m.xpReward)} XP
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <form action={toggleMission}>
                  <input type="hidden" name="missionId" value={m.id} />
                  <input type="hidden" name="next" value={m.isActive ? "false" : "true"} />
                  <SubmitButton
                    className="bg-raised text-text hover:bg-raised-2"
                    pendingLabel="…"
                  >
                    {m.isActive ? "Выключить" : "Включить"}
                  </SubmitButton>
                </form>
                <form action={deleteMission}>
                  <input type="hidden" name="missionId" value={m.id} />
                  <ConfirmSubmit
                    aria-label="Удалить цель"
                    triggerClassName="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                    confirmLabel="Удалить"
                    prompt="Точно?"
                  >
                    <Trash2 className="size-4" />
                  </ConfirmSubmit>
                </form>
              </div>
            </Card>
          ))
        )}
      </section>

      {/* ---------------- достижения ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Достижения</h3>
        </div>

        <Card className="p-5">
          <form action={createAchievement} className="grid gap-3 sm:grid-cols-2">
            <Field label="Название">
              <TextInput name="title" required placeholder="Марафонец" />
            </Field>
            <Field label="Описание">
              <TextInput name="description" placeholder="Заверши 10 уроков" />
            </Field>
            <Field label="Сколько уроков нужно пройти">
              <TextInput name="target" type="number" min="1" defaultValue={5} />
            </Field>
            <Field label="Награда, XP">
              <TextInput name="xpReward" type="number" min="0" step="10" defaultValue={50} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Создаём…">Добавить достижение</SubmitButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-faint">
            Достижение сразу открывается всем, кто уже прошёл нужное количество уроков, —
            вместе с наградой XP. То же происходит при изменении порога.
          </p>
        </Card>

        {achievements.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-muted">
            Достижений нет — раздел «Достижения» у студентов пустой.
          </p>
        ) : (
          achievements.map((a) => (
            <Card key={a.id} className="p-4">
              <form action={updateAchievement} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="achievementId" value={a.id} />
                <Field label="Название">
                  <TextInput name="title" defaultValue={a.title} required />
                </Field>
                <Field label="Описание">
                  <TextInput name="description" defaultValue={a.description} />
                </Field>
                <Field label="Сколько уроков нужно пройти">
                  <TextInput name="target" type="number" min="1" defaultValue={a.target} />
                </Field>
                <Field label="Награда, XP">
                  <TextInput
                    name="xpReward"
                    type="number"
                    min="0"
                    step="10"
                    defaultValue={a.xpReward}
                  />
                </Field>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <SubmitButton>Сохранить</SubmitButton>
                  <span className="font-mono text-xs text-faint">
                    {a.target} уроков · +{formatNumber(a.xpReward)} XP
                  </span>
                </div>
              </form>
              <form action={deleteAchievement} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="achievementId" value={a.id} />
                <ConfirmSubmit
                  triggerClassName="inline-flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-danger"
                  confirmLabel="Удалить"
                  prompt="Удалить достижение?"
                >
                  <Trash2 className="size-3.5" />
                  Удалить достижение
                </ConfirmSubmit>
              </form>
            </Card>
          ))
        )}
      </section>

      {/* ---------------- магазин ---------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Награды за XP</h3>
        </div>

        <Card className="p-5">
          <form action={createStoreItem} className="grid gap-3 sm:grid-cols-2">
            <Field label="Название">
              <TextInput name="name" required placeholder="Футболка OQU" />
            </Field>
            <Field label="Описание">
              <TextInput name="description" placeholder="Мерч для настоящих билдеров" />
            </Field>
            <Field label="Нужно XP">
              <TextInput name="xpRequired" type="number" min="0" step="50" defaultValue={300} />
            </Field>
            <Field label="Тип">
              <Select name="category" defaultValue="merch">
                <option value="merch">Мерч</option>
                <option value="guide">Гайд</option>
                <option value="video">Видео</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="Ссылка для скачивания / просмотра"
                hint="для гайдов и видео — студент получит её после разблокировки"
              >
                <TextInput name="payloadUrl" type="url" placeholder="https://..." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Создаём…">Добавить награду</SubmitButton>
            </div>
          </form>
        </Card>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-muted">
            Наград нет — раздел «Магазин» у студентов пустой.
          </p>
        ) : (
          items.map((i) => (
            <Card key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{i.name}</p>
                  <Badge variant="neutral">{CATEGORY_LABEL[i.category] ?? i.category}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">{i.description}</p>
                <p className="mt-0.5 font-mono text-xs text-gold">
                  {formatNumber(i.xpRequired)} XP
                </p>
              </div>
              <form action={deleteStoreItem} className="shrink-0">
                <input type="hidden" name="itemId" value={i.id} />
                <ConfirmSubmit
                  aria-label="Удалить награду"
                  triggerClassName="grid size-9 place-items-center rounded-lg border border-line text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                  confirmLabel="Удалить"
                  prompt="Точно?"
                >
                  <Trash2 className="size-4" />
                </ConfirmSubmit>
              </form>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
