import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Trophy,
  Flame,
  ArrowRight,
  Award,
  Lock,
  Send,
  LogOut,
  KeyRound,
} from "lucide-react";
import { getProfile } from "@/data/profile";
import { logout } from "@/app/login/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/admin/stat-card";
import { PasswordForm } from "./password-form";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Профиль" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || "?";
}

export default async function ProfilePage() {
  const { profile, stats, courses, topAchievements } = await getProfile();

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {/* Шапка */}
      <Card className="bg-gradient-to-b from-raised to-surface p-6 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0 self-center sm:self-auto">
            <div className="grid size-24 place-items-center rounded-full border border-gold/25 bg-gold/10 font-display text-3xl font-extrabold text-gold shadow-glow">
              {initials(profile.fullName)}
            </div>
            <span className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border border-gold/40 bg-gold font-mono text-sm font-bold text-gold-ink shadow-glow">
              {profile.level}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
                {profile.fullName}
              </h1>
              <Badge variant="gold">
                <Award className="size-3" />
                {profile.rank}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">{profile.email}</p>

            <div className="mt-5">
              <div className="mb-1.5 flex items-end justify-between gap-2">
                <span className="font-display text-sm font-bold">
                  Уровень {profile.level}
                  <span className="text-faint"> → {profile.level + 1}</span>
                </span>
                <span className="nums font-mono text-xs text-muted">
                  <span className="text-gold">{formatNumber(profile.xpIntoLevel)}</span>
                  {" / "}
                  {formatNumber(profile.xpSpan)} XP
                </span>
              </div>
              <ProgressBar
                value={profile.percent}
                aria-label={`Прогресс уровня ${profile.percent}%`}
              />
              <p className="mt-1.5 text-xs text-faint">
                ещё {formatNumber(profile.xpToNext)} XP до следующего уровня
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Статистика */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Курсов" value={stats.courses} />
        {/* Lifetime total across ALL lessons (incl. free previews of unbought
            courses) — labelled "всего" so it doesn't clash with the dashboard's
            per-course "Пройдено уроков" X/Y fraction. */}
        <StatCard
          icon={GraduationCap}
          label="Пройдено всего"
          value={stats.lessonsCompleted}
        />
        <StatCard icon={Trophy} label="Достижений" value={stats.achievements} />
        <StatCard
          icon={Flame}
          label="Дней подряд"
          value={profile.streak}
          sub={`рекорд ${profile.longestStreak}`}
        />
      </div>

      {/* Мои курсы */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-extrabold">Мои курсы</h2>
        {courses.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">
            Вы пока не записаны ни на один курс.
          </Card>
        ) : (
          <div className="space-y-3">
            {courses.map((c) => (
              <Link
                key={c.slug}
                href={`/course/${c.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 ring-inset-hair transition duration-300 ease-[var(--ease-soft)] hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
                  <BookOpen className="size-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-display font-bold">{c.title}</p>
                    <span className="nums shrink-0 font-mono text-xs text-muted">
                      {c.done}/{c.total}{" "}
                      {pluralize(c.total, ["урок", "урока", "уроков"])}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar
                      value={c.progress}
                      className="flex-1"
                      aria-label={`Прогресс курса ${c.title}`}
                    />
                    <span className="nums w-10 shrink-0 text-right text-xs font-medium text-text">
                      {c.progress}%
                    </span>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Достижения */}
      {topAchievements.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl font-extrabold">Достижения</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topAchievements.map((a) => (
              <div
                key={a.title}
                className={
                  a.unlocked
                    ? "flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 ring-inset-hair"
                    : "flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 ring-inset-hair"
                }
              >
                <div
                  className={
                    a.unlocked
                      ? "grid size-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold"
                      : "grid size-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-white/5 text-faint"
                  }
                >
                  {a.unlocked ? (
                    <Trophy className="size-5" strokeWidth={1.8} />
                  ) : (
                    <Lock className="size-5" strokeWidth={1.8} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-bold">
                    {a.title}
                  </p>
                  <p
                    className={
                      a.unlocked
                        ? "mt-0.5 text-xs text-gold"
                        : "mt-0.5 text-xs text-faint"
                    }
                  >
                    {a.unlocked ? "Получено" : "Заблокировано"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Настройки */}
      <section className="space-y-4">
        <h2 className="font-display text-xl font-extrabold">Настройки</h2>

        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
              <KeyRound className="size-5" strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-display font-bold">Смена пароля</h3>
              <p className="text-xs text-muted">
                Новый пароль — не короче 8 символов.
              </p>
            </div>
          </div>
          <PasswordForm />
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-raised to-surface p-6">
          <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-gold/10 blur-2xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold shadow-glow">
                <Send className="size-5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold">AI-Наставник в Telegram</h3>
                  <Badge variant="neutral">Скоро</Badge>
                </div>
                <p className="mt-0.5 text-sm text-muted">
                  Подключите бота, чтобы учиться и получать разборы прямо в мессенджере.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex shrink-0 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line-strong bg-raised px-4 py-2.5 text-sm font-semibold text-muted opacity-70"
            >
              Подключить
            </button>
          </div>
        </Card>

        <form action={logout}>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger transition-colors hover:bg-danger/20"
          >
            <LogOut className="size-4" />
            Выйти
          </button>
        </form>
      </section>
    </div>
  );
}
