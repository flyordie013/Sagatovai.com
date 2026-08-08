import Link from "next/link";
import { Inbox, Mail, MessageCircle, ArrowRight, Info } from "lucide-react";
import { getPurchaseRequests } from "@/data/admin";
import { grantAccess, declineRequest } from "../actions";
import { Card } from "@/components/ui/card";
import { Field, TextInput, Select, SubmitButton, ConfirmSubmit } from "@/components/admin/form";
import { formatDate } from "@/components/admin/format";
import { formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Запросы на доступ" };

/**
 * `payments.note` is free text: it always carries the "заявка из каталога" line
 * and may additionally carry the phone the student left. Only a Kazakh number
 * becomes a link — an href built from an order id or a БИН would open a chat
 * with a stranger. Nothing is rendered when the note holds no number.
 */
const PHONE_CANDIDATE = /[+\d][\d\s()-]{8,}\d/g;

function whatsappContact(note: string): { href: string; display: string } | null {
  for (const raw of note.match(PHONE_CANDIDATE) ?? []) {
    let digits = raw.replace(/\D/g, "");
    // «7071234567» (no country code) and «8 707…» are how people actually type
    // it; both mean the same number as «+7 707…».
    if (digits.length === 10) digits = `7${digits}`;
    else if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
    // Country code 7 + a national number that also starts with 7 — every KZ
    // code does, while a Russian mobile starts with 9, so a neighbouring
    // number pasted by mistake is left alone.
    if (!/^77\d{9}$/.test(digits)) continue;
    return {
      href: `https://wa.me/${digits}`,
      display: `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`,
    };
  }
  return null;
}

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
          {requests.map((r) => {
            const wa = whatsappContact(r.note);
            return (
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
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <a
                        href={`mailto:${r.userEmail}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-gold underline-offset-2 hover:underline"
                      >
                        <Mail className="size-3.5" />
                        {r.userEmail}
                      </a>
                      {/* Shown only when the student left a number — writing in
                          WhatsApp gets an answer far sooner than an email. */}
                      {wa && (
                        <a
                          href={wa.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-gold underline-offset-2 hover:underline"
                        >
                          <MessageCircle className="size-3.5" />
                          {wa.display}
                        </a>
                      )}
                    </div>
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
            );
          })}
        </>
      )}
    </div>
  );
}
