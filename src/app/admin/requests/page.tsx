import Link from "next/link";
import { Inbox, Mail, ArrowRight, Info } from "lucide-react";
import { getPurchaseRequests } from "@/data/admin";
import { grantAccess, declineRequest } from "../actions";
import { Card } from "@/components/ui/card";
import { Field, TextInput, Select, SubmitButton, ConfirmSubmit } from "@/components/admin/form";
import { formatDate } from "@/components/admin/format";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Запросы на доступ" };

export default async function RequestsPage() {
  const requests = await getPurchaseRequests();

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
          Продажи
        </p>
        <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
          Запросы на доступ к курсу
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Здесь <strong className="text-text">зарегистрированные студенты</strong>, которые
          нажали «Оставить заявку» на платном курсе. Обращения посетителей без аккаунта —
          в разделе{" "}
          <Link href="/admin/leads" className="text-gold underline-offset-2 hover:underline">
            «Лиды с сайта»
          </Link>
          .
        </p>
      </header>

      {/* How this page works — it was not obvious what the form actually does. */}
      <Card className="flex gap-3 border-gold/20 bg-gold/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" />
        <p className="text-sm leading-relaxed text-muted">
          Порядок работы: свяжитесь со студентом по email, примите оплату (Kaspi / перевод),
          затем нажмите <strong className="text-text">«Выдать доступ»</strong> — курс сразу
          откроется у него в кабинете, а запрос станет оплатой и попадёт в выручку. Сумма
          подставлена из цены курса — измените, если была скидка.
        </p>
      </Card>

      {requests.length === 0 ? (
        <Card className="grid place-items-center gap-3 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-line-strong bg-white/5 text-muted">
            <Inbox className="size-6" />
          </div>
          <div>
            <p className="font-display font-bold">Открытых запросов нет</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Запрос появится здесь, когда студент откроет платный курс в каталоге и нажмёт
              «Оставить заявку».
            </p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {requests.length}{" "}
            {pluralize(requests.length, ["запрос", "запроса", "запросов"])} ждут ответа
          </p>
          {requests.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold">{r.courseTitle}</p>
                  <p className="mt-1 text-sm text-muted">
                    <Link
                      href={`/admin/users/${r.userId}`}
                      className="text-text underline-offset-2 hover:underline"
                    >
                      {r.userName}
                    </Link>{" "}
                    · {formatDate(r.createdAt)}
                  </p>
                  <a
                    href={`mailto:${r.userEmail}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-gold underline-offset-2 hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {r.userEmail}
                  </a>
                </div>
                <span className="nums shrink-0 font-mono text-lg font-bold text-gold">
                  {formatNumber(r.coursePrice || r.amount)} ₸
                </span>
              </div>

              <form
                action={grantAccess}
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
              >
                <input type="hidden" name="userId" value={r.userId} />
                <input type="hidden" name="courseId" value={r.courseId} />
                <div className="w-36">
                  <Field label="Оплачено (₸)">
                    <TextInput
                      name="amount"
                      type="number"
                      min="0"
                      step="1000"
                      defaultValue={r.coursePrice || r.amount}
                    />
                  </Field>
                </div>
                <Field label="Как оплатил">
                  <Select name="method" defaultValue="kaspi">
                    <option value="kaspi">Kaspi</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="card">Карта</option>
                    <option value="manual">Вручную</option>
                  </Select>
                </Field>
                <SubmitButton pendingLabel="Выдаём…">
                  Выдать доступ
                  <ArrowRight className="size-4" />
                </SubmitButton>
              </form>

              <form action={declineRequest} className="mt-3 border-t border-line pt-3">
                <input type="hidden" name="paymentId" value={r.id} />
                <ConfirmSubmit
                  triggerClassName="text-xs text-muted transition-colors hover:text-danger"
                  confirmLabel="Отклонить"
                  prompt="Закрыть запрос без выдачи доступа?"
                >
                  Отклонить запрос
                </ConfirmSubmit>
              </form>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
