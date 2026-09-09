import Link from "next/link";
import { ChevronRight, Flame, UserPlus, Search } from "lucide-react";
import { listUsers } from "@/data/admin";
import { createUser } from "../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, TextInput, Select, SubmitButton } from "@/components/admin/form";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Пользователи" };

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const isStaff = (role: string) => role === "admin" || role === "superadmin";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const { rows: users, total, page, pageSize } = await listUsers({
    q,
    page: Number(sp.page) || 1,
  });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const linkTo = (p: number) =>
    `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <header>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Пользователи</h2>
        <p className="mt-1.5 text-sm text-muted">
          {formatNumber(total)} {pluralize(total, ["человек", "человека", "человек"])}{" "}
          {q ? "найдено" : "на платформе"}
        </p>
      </header>

      {/* Search by name or email. */}
      <form method="get" className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Поиск по имени или email…"
            className="w-full rounded-xl border border-line-strong bg-raised py-2.5 pl-9 pr-3.5 text-sm text-text placeholder:text-faint outline-none transition-colors focus:border-gold/50 focus:bg-raised-2 focus-visible:ring-2 focus-visible:ring-gold/40"
          />
        </div>
        <SubmitButton className="shrink-0">Найти</SubmitButton>
        {q && (
          <Link
            href="/admin/users"
            className="inline-flex shrink-0 items-center rounded-xl border border-line-strong bg-raised px-4 text-sm text-muted transition-colors hover:text-text"
          >
            Сброс
          </Link>
        )}
      </form>

      {/* Create an account manually after a verified payment. */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="size-4 text-gold" />
          <h3 className="font-display text-lg font-bold">Создать пользователя</h3>
        </div>
        <form action={createUser} className="grid gap-3 sm:grid-cols-2">
          <Field label="Имя и фамилия">
            <TextInput name="fullName" required maxLength={120} placeholder="Айгерим Тлеубаева" />
          </Field>
          <Field label="Email">
            <TextInput name="email" type="email" required maxLength={200} placeholder="student@mail.kz" />
          </Field>
          <Field label="Пароль" hint="минимум 8 символов — передайте студенту">
            <TextInput name="password" type="text" required minLength={8} placeholder="например: oqu-2026-kz" />
          </Field>
          {/* "curator" is deliberately gone: the role has no screens of its own
              (not staff → bounced out of /admin), so it made dead accounts. */}
          <Field label="Роль">
            <Select name="role" defaultValue="student">
              <option value="student">Студент</option>
              <option value="admin">Админ — полный доступ к этой панели</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Создаём…">Создать</SubmitButton>
          </div>
        </form>
        <p className="mt-3 text-xs text-faint">
          Студент сразу получит доступ к бесплатным курсам. Платный курс откройте на его
          странице через «Выдать доступ».
        </p>
      </Card>

      {users.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted">
          {q ? `Никого не нашли по запросу «${q}».` : "Пользователей пока нет."}
        </Card>
      )}

      <div className="grid gap-3">
        {users.map((u) => (
          <Link key={u.id} href={`/admin/users/${u.id}`} className="group">
            <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-strong">
              <div className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/25 bg-gold/10 font-display text-sm font-bold text-gold">
                {initials(u.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{u.fullName}</p>
                  {isStaff(u.role) && <Badge variant="gold">{u.role === "superadmin" ? "Владелец" : "Админ"}</Badge>}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted">{u.email}</p>
              </div>
              <div className="hidden shrink-0 items-center gap-5 font-mono text-xs text-muted sm:flex">
                <div className="text-center">
                  <div className="nums text-sm font-semibold text-text">{u.level}</div>
                  <div>уровень</div>
                </div>
                <div className="text-center">
                  <div className="nums text-sm font-semibold text-gold">{formatNumber(u.xp)}</div>
                  <div>XP</div>
                </div>
                <div className="text-center">
                  <div className="nums flex items-center gap-1 text-sm font-semibold text-text">
                    <Flame className="size-3.5 text-gold" />
                    {u.currentStreak}
                  </div>
                  <div>стрик</div>
                </div>
                <div className="text-center">
                  <div className="nums text-sm font-semibold text-text">{u.completed}</div>
                  <div>уроков</div>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
            </Card>
          </Link>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between pt-1">
          {page > 1 ? (
            <Link
              href={linkTo(page - 1)}
              className="rounded-xl border border-line-strong bg-raised px-4 py-2 text-sm text-text transition-colors hover:bg-raised-2"
            >
              ← Назад
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">
            Стр. {page} из {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={linkTo(page + 1)}
              className="rounded-xl border border-line-strong bg-raised px-4 py-2 text-sm text-text transition-colors hover:bg-raised-2"
            >
              Вперёд →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
