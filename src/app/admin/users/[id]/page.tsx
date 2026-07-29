import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  BookOpen,
  CheckCircle2,
  ShoppingCart,
  Wallet,
  KeyRound,
  UserCog,
  Trash2,
} from "lucide-react";
import { getUserForAdmin, listCourses } from "@/data/admin";
import {
  grantAccess,
  resetUserPassword,
  revokeAccess,
  updateUser,
  deleteUser,
} from "../../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/admin/stat-card";
import { Field, TextInput, Select, SubmitButton, ConfirmSubmit } from "@/components/admin/form";
import { formatDate } from "@/components/admin/format";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Профиль пользователя" };

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const METHOD_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  kaspi: "Kaspi",
  card: "Карта",
  manual: "Вручную",
};
const STATUS: Record<string, { label: string; variant: "teal" | "gold" | "danger" | "neutral" }> = {
  paid: { label: "Оплачено", variant: "teal" },
  requested: { label: "Заявка", variant: "gold" },
  refunded: { label: "Возврат", variant: "danger" },
  declined: { label: "Отклонено", variant: "neutral" },
};

export default async function AdminUserDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, courses] = await Promise.all([getUserForAdmin(id), listCourses()]);
  if (!data) notFound();

  const {
    user,
    isSelf,
    canDelete,
    canChangeRole,
    canGrantOwner,
    enrollments,
    totalCompleted,
    payments: userPayments,
    paidCount,
    spent,
  } = data;
  const isStaff = user.role === "admin" || user.role === "superadmin";
  // Archived courses can't be granted (they're retired) — used for both the
  // empty-state guard and the dropdown so they never disagree.
  const grantable = courses.filter((c) => !c.isArchived);

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-4" />
        К списку пользователей
      </Link>

      {/* profile header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 font-display text-xl font-bold text-gold">
            {initials(user.fullName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold">{user.fullName}</h2>
              {isStaff && (
                <Badge variant="gold">
                  {user.role === "superadmin" ? "Владелец" : "Админ"}
                </Badge>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{user.email}</p>
            <p className="mt-1 text-sm text-muted">
              {user.rank} · Уровень {user.level} ·{" "}
              <span className="text-gold">{formatNumber(user.xp)} XP</span> ·{" "}
              <span className="inline-flex items-center gap-1">
                <Flame className="size-3.5 text-gold" />
                {user.currentStreak} дн.
              </span>
            </p>
          </div>
        </div>
      </Card>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={BookOpen} label="Курсов" value={enrollments.length} />
        <StatCard icon={CheckCircle2} label="Уроков пройдено" value={totalCompleted} />
        <StatCard icon={ShoppingCart} label="Покупок" value={paidCount} />
        <StatCard icon={Wallet} label="Потрачено" value={`${formatNumber(spent)} ₸`} />
      </div>

      {/* grant access */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Выдать доступ к курсу</h3>
        </div>
        {grantable.length === 0 ? (
          <p className="text-sm text-muted">
            Сначала{" "}
            <Link href="/admin/courses" className="text-gold underline-offset-2 hover:underline">
              создайте курс
            </Link>{" "}
            — тогда его можно будет выдать.
          </p>
        ) : (
        <form action={grantAccess} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={user.id} />
          <div className="min-w-52 flex-1">
            <Field label="Курс">
              <Select name="courseId">
                {grantable.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                    {!c.isPublished ? " · черновик" : ""}
                    {c.price > 0 ? ` · ${formatNumber(c.price)} ₸` : " · бесплатно"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-36">
            <Field label="Сумма (₸)" hint="пусто = цена курса; 0 = бесплатно">
              <TextInput
                name="amount"
                type="number"
                min="0"
                step="1000"
                placeholder="цена курса"
              />
            </Field>
          </div>
          <Field label="Способ">
            <Select name="method" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="kaspi">Kaspi</option>
              <option value="card">Карта</option>
              <option value="manual">Вручную</option>
            </Select>
          </Field>
          <SubmitButton pendingLabel="Выдаём…">Выдать доступ</SubmitButton>
        </form>
        )}
      </Card>

      {/* password reset — the only recovery path until self-service reset exists */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Сбросить пароль</h3>
        </div>
        <form action={resetUserPassword} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="userId" value={user.id} />
          <div className="min-w-52 flex-1">
            <Field label="Новый пароль" hint="минимум 8 символов — передайте пользователю">
              <TextInput name="password" type="text" required minLength={8} placeholder="новый-пароль-2026" />
            </Field>
          </div>
          <SubmitButton pendingLabel="Сохраняем…">Установить</SubmitButton>
        </form>
        <p className="mt-3 text-xs text-faint">
          Старый пароль перестанет работать сразу. Все уже открытые сессии этого
          пользователя завершатся — на всех устройствах придётся войти заново.
        </p>
        {isSelf && (
          <p className="mt-2 text-xs font-medium text-danger">
            Это ваш собственный аккаунт: после сброса вас выкинет из системы, войдите заново
            с новым паролем.
          </p>
        )}
      </Card>

      {/* account settings — until now a created account could never be fixed */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserCog className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Данные аккаунта</h3>
        </div>
        <form action={updateUser} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="userId" value={user.id} />
          <Field label="Имя и фамилия">
            <TextInput name="fullName" defaultValue={user.fullName} required maxLength={120} />
          </Field>
          <Field label="Email" hint="это логин для входа">
            <TextInput
              name="email"
              type="email"
              defaultValue={user.email}
              required
              maxLength={200}
            />
          </Field>
          <Field
            label="Роль"
            hint={
              isSelf
                ? "свою роль менять нельзя"
                : !canChangeRole
                  ? "это последний владелец"
                  : undefined
            }
          >
            <Select name="role" defaultValue={user.role} disabled={!canChangeRole}>
              <option value="student">Студент</option>
              <option value="admin">Админ — полный доступ к этой панели</option>
              {(canGrantOwner || user.role === "superadmin") && (
                <option value="superadmin">Владелец</option>
              )}
              {user.role === "curator" && <option value="curator">Куратор (устаревшая)</option>}
            </Select>
          </Field>
          <div className="flex items-end">
            <SubmitButton>Сохранить</SubmitButton>
          </div>
        </form>
        <div className="mt-4 border-t border-line pt-4">
          {canDelete ? (
            <form action={deleteUser}>
              <input type="hidden" name="userId" value={user.id} />
              <ConfirmSubmit
                triggerClassName="inline-flex items-center gap-1.5 text-xs text-danger transition-colors hover:underline"
                confirmLabel="Удалить пользователя"
                prompt={
                  paidCount > 0
                    ? `У пользователя ${paidCount} ${pluralize(paidCount, ["оплата", "оплаты", "оплат"])} на ${formatNumber(spent)} ₸ — они исчезнут из выручки. Удалить?`
                    : "Удалить аккаунт со всем прогрессом?"
                }
              >
                <Trash2 className="size-3.5" />
                Удалить пользователя
              </ConfirmSubmit>
              <p className="mt-2 text-xs text-faint">
                Удаление безвозвратно: вместе с аккаунтом пропадут прогресс, доступы и
                история платежей.
                {paidCount > 0 && (
                  <>
                    {" "}
                    <span className="text-danger">
                      Учтите: {formatNumber(spent)} ₸ уйдут из общей выручки.
                    </span>
                  </>
                )}
              </p>
            </form>
          ) : (
            <p className="text-xs text-faint">
              {isSelf
                ? "Свой аккаунт удалить нельзя."
                : "Это последний владелец платформы — его нельзя удалить или понизить."}
            </p>
          )}
        </div>
      </Card>

      {/* enrollments / progress */}
      <section className="space-y-3">
        <h3 className="font-display text-lg font-bold">Обучение и доступ</h3>
        {enrollments.length === 0 && <p className="text-sm text-muted">Нет зачислений.</p>}
        {enrollments.map((e) => (
          <Card key={e.courseId} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{e.title}</p>
              <Badge
                variant={
                  e.accessType === "locked"
                    ? "neutral"
                    : e.accessType === "trial"
                      ? "gold"
                      : "teal"
                }
              >
                {e.accessType === "locked"
                  ? "Заблокирован"
                  : e.accessType === "trial"
                    ? "Пробный"
                    : "Полный доступ"}
              </Badge>
            </div>
            {e.accessType !== "locked" && (
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted">Прогресс</span>
                  <span className="nums font-medium text-text">
                    {e.done}/{e.total} · {e.progress}%
                  </span>
                </div>
                <ProgressBar value={e.progress} aria-label={`Прогресс ${e.title}`} />
              </div>
            )}
            <form action={revokeAccess} className="mt-3 border-t border-line pt-3">
              <input type="hidden" name="userId" value={user.id} />
              <input type="hidden" name="courseId" value={e.courseId} />
              <ConfirmSubmit
                triggerClassName="text-xs text-muted transition-colors hover:text-danger"
                confirmLabel="Отозвать"
                prompt="Закрыть доступ и оформить возврат оплаты?"
              >
                Отозвать доступ
              </ConfirmSubmit>
            </form>
          </Card>
        ))}
      </section>

      {/* payments */}
      {userPayments.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-bold">Платежи</h3>
          {userPayments.map((p) => {
            const st = STATUS[p.status] ?? STATUS.requested;
            return (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.courseTitle}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {METHOD_LABEL[p.method] ?? p.method} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="nums font-display text-lg font-bold text-gold">
                    {formatNumber(p.amount)} ₸
                  </span>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
