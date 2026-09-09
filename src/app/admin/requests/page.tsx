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
          нажали «Оставить заявку» на курсе. Обращения посетителей без аккаунта — в разделе{" "}
          <Link href="/admin/leads" className="text-gold underline-offset-2 hover:underline">
            «Лиды с сайта»
          </Link>
          .
        </p>
      </header>

      <Card className="flex gap-3 border-gold/20 bg-gold/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-gold" />
        <p className="text-sm leading-relaxed text-muted">
          Свяжитесь со студентом по email, проверьте оплату и только затем нажмите{" "}
          <strong className="text-text">«Выдать доступ»</strong>. Курс откроется только
          этому пользователю, а подтверждённая сумма попадёт в выручку.
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
              Запрос появится здесь, когда зарегистрированный студент нажмёт
              «Оставить заявку» на странице курса.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {requests.length}{" "}
            {pluralize(requests.length, ["запрос", "запроса", "запросов"])} ждут ответа
          </p>
          {requests.map((request) => (
            <Card key={request.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold">{request.courseTitle}</p>
                  <p className="mt-1 text-sm text-muted">
                    <Link
                      href={`/admin/users/${request.userId}`}
                      className="text-text underline-offset-2 hover:underline"
                    >
                      {request.userName}
                    </Link>{" "}
                    · {formatDate(request.createdAt)}
                  </p>
                  <a
                    href={`mailto:${request.userEmail}`}
                    className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-gold underline-offset-2 hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {request.userEmail}
                  </a>
                </div>
                <span className="nums shrink-0 font-mono text-lg font-bold text-gold">
                  {formatNumber(request.coursePrice || request.amount)} ₸
                </span>
              </div>

              <form
                action={grantAccess}
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
              >
                <input type="hidden" name="userId" value={request.userId} />
                <input type="hidden" name="courseId" value={request.courseId} />
                <div className="w-36">
                  <Field label="Оплачено (₸)">
                    <TextInput
                      name="amount"
                      type="number"
                      min="0"
                      step="1000"
                      defaultValue={request.coursePrice || request.amount}
                    />
                  </Field>
                </div>
                <Field label="Как оплатил">
                  <Select name="method" defaultValue="kaspi">
                    <option value="kaspi">Kaspi</option>
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
                <input type="hidden" name="paymentId" value={request.id} />
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
