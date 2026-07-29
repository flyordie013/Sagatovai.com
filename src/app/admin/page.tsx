import Link from "next/link";
import {
  Users,
  BookOpen,
  GraduationCap,
  Layers,
  ShoppingCart,
  Wallet,
  CheckCircle2,
  Shield,
  Inbox,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { getAdminStats } from "@/data/admin";
import { StatCard } from "@/components/admin/stat-card";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "Дашборд" };

export default async function AdminDashboard() {
  const s = await getAdminStats();

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
          Обзор
        </p>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
          Статистика платформы
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Ключевые метрики по пользователям, контенту и продажам.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Студентов"
          value={formatNumber(s.students)}
          sub={`${s.activeLearners} активных`}
        />
        <StatCard
          icon={BookOpen}
          label="Курсов"
          value={s.courses}
          sub={`${s.publishedCourses} опубл.`}
        />
        <StatCard icon={GraduationCap} label="Уроков" value={formatNumber(s.lessons)} />
        <StatCard icon={Layers} label="Зачислений" value={formatNumber(s.enrollments)} />
        <StatCard
          icon={ShoppingCart}
          label="Покупок"
          value={s.purchases}
        />
        <StatCard
          icon={Wallet}
          label="Выручка"
          value={`${formatNumber(s.revenue)} ₸`}
        />
        {/* Two separate funnels — the labels must never read the same. */}
        <StatCard
          icon={Inbox}
          label="Запросы на доступ"
          value={s.openRequests}
          sub={s.openRequests > 0 ? "ждут выдачи" : undefined}
          href="/admin/requests"
        />
        <StatCard
          icon={MessageSquare}
          label="Лиды с сайта"
          value={s.newLeads}
          sub={s.leadsTotal > 0 ? `новых из ${s.leadsTotal}` : undefined}
          href="/admin/leads"
        />
        <StatCard
          icon={CheckCircle2}
          label="Уроков пройдено"
          value={formatNumber(s.completedLessons)}
        />
        <StatCard icon={Shield} label="Администраторов" value={s.admins} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          href="/admin/courses"
          icon={BookOpen}
          title="Управление курсами"
          desc="Создавайте курсы, добавляйте модули и уроки, наполняйте их информацией."
        />
        <QuickLink
          href="/admin/users"
          icon={Users}
          title="Пользователи"
          desc="Прогресс обучения, покупки и активность каждого студента."
        />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: typeof BookOpen;
  title: string;
  desc: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="flex items-center gap-4 p-5 transition-colors hover:border-line-strong">
        <div className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="font-display font-bold">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{desc}</p>
        </div>
        <ArrowRight className="ml-auto size-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-gold" />
      </Card>
    </Link>
  );
}
