import Link from "next/link";
import { MessageSquare, Phone, BookOpen } from "lucide-react";
import { listLeads, LEADS_LIMIT } from "@/data/admin";
import { setLeadStatus, deleteLead } from "../actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/admin/form";
import { formatDateTime } from "@/components/admin/format";
import { formatNumber, pluralize } from "@/lib/utils";

const NEXT_STATUSES = [
  { value: "contacted", label: "Связались" },
  { value: "won", label: "Купил" },
  { value: "lost", label: "Отказ" },
  { value: "new", label: "Вернуть в новые" },
] as const;

export const metadata = { title: "Лиды с сайта" };

const STATUS: Record<string, { label: string; variant: "gold" | "teal" | "neutral" | "danger" }> = {
  new: { label: "Новый", variant: "gold" },
  contacted: { label: "Связались", variant: "teal" },
  won: { label: "Купил", variant: "teal" },
  lost: { label: "Отказ", variant: "neutral" },
};

export default async function AdminLeadsPage() {
  const { rows, total, fresh } = await listLeads();

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
          Продажи
        </p>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Лиды с сайта</h2>
        <p className="mt-1.5 text-sm text-muted">
          Обращения посетителей, у которых ещё{" "}
          <strong className="text-text">нет аккаунта</strong>.{" "}
          {fresh > 0
            ? `${fresh} ${pluralize(fresh, ["новый", "новых", "новых"])} — свяжитесь, создайте аккаунт и откройте доступ.`
            : "Новых лидов нет."}{" "}
          Студенты, уже зарегистрированные на платформе, оставляют заявку на курс в разделе{" "}
          <Link href="/admin/requests" className="text-gold underline-offset-2 hover:underline">
            «Запросы на доступ»
          </Link>
          .
        </p>
        {total > rows.length && (
          <p className="mt-2 text-sm text-muted">
            Показаны последние {formatNumber(LEADS_LIMIT)} обращений из{" "}
            {formatNumber(total)}. Разберите их — и увидите следующие: ненужные
            можно удалить кнопкой «Удалить».
          </p>
        )}
      </header>

      {rows.length === 0 ? (
        <Card className="grid place-items-center px-6 py-14 text-center">
          <MessageSquare className="mb-3 size-8 text-faint" />
          <p className="font-display font-bold">Пока нет лидов</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Обращения с формы на публичной странице сайта появятся здесь.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((l) => {
            const st = STATUS[l.status] ?? STATUS.new;
            return (
              <Card key={l.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold">{l.name}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-gold">
                      <Phone className="size-3.5" />
                      {l.contact}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <span className="font-mono text-xs text-faint">
                        {formatDateTime(l.createdAt)}
                      </span>
                    </div>
                    {/* Triage: without this every lead stays "Новый" forever. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {NEXT_STATUSES.filter((s) => s.value !== l.status).map((s) => (
                        <form key={s.value} action={setLeadStatus}>
                          <input type="hidden" name="leadId" value={l.id} />
                          <input type="hidden" name="next" value={s.value} />
                          <button
                            type="submit"
                            className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-text"
                          >
                            {s.label}
                          </button>
                        </form>
                      ))}
                      {/* Spam and duplicates: without this they stay in the
                          inbox forever. Irreversible → confirm first. */}
                      <form action={deleteLead}>
                        <input type="hidden" name="leadId" value={l.id} />
                        <ConfirmSubmit
                          triggerClassName="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-danger/40 hover:text-danger"
                          confirmLabel="Удалить"
                          prompt="Удалить лид навсегда?"
                          aria-label={`Удалить лид ${l.name}`}
                        >
                          Удалить
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </div>
                </div>

                {l.courseTitle && (
                  <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-muted">
                    <BookOpen className="size-3.5" />
                    Интересует: {l.courseTitle}
                  </p>
                )}
                {l.comment && (
                  <p className="mt-2.5 rounded-xl border border-line bg-raised px-3.5 py-2.5 text-sm text-muted">
                    {l.comment}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
