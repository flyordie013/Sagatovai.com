"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { courses, leads } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { sendEmail, emailLayout } from "@/lib/email";
import { OWNER_NOTIFY_EMAIL } from "@/lib/contacts";

export interface LeadState {
  ok?: boolean;
  error?: string;
}

const MAX = { name: 120, contact: 120, comment: 1000 };

// Absolute link for the notification. Built from APP_URL (same source as
// metadataBase/robots), never from the request Host header.
const ADMIN_LEADS_URL = `${(process.env.APP_URL || "https://sagatovai.com").replace(/\/$/, "")}/admin/leads`;

/** Every field below is visitor-controlled — never interpolate it raw into HTML. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Captures a lead from the PUBLIC storefront (visitor has no account yet).
 * Deliberately unauthenticated, so it is rate-limited by IP and every field is
 * length-capped. `courseId` is validated against published courses only.
 */
export async function submitLead(
  _prev: LeadState,
  formData: FormData,
): Promise<LeadState> {
  const name = (formData.get("name") ?? "").toString().trim();
  const contact = (formData.get("contact") ?? "").toString().trim();
  const comment = (formData.get("comment") ?? "").toString().trim();
  const courseIdRaw = (formData.get("courseId") ?? "").toString().trim();

  if (!name || !contact) {
    return { error: "Укажите имя и контакт — телефон, WhatsApp или email." };
  }
  if (name.length > MAX.name || contact.length > MAX.contact) {
    return { error: "Слишком длинное значение в поле." };
  }
  if (comment.length > MAX.comment) {
    return { error: "Комментарий слишком длинный." };
  }

  const h = await headers();
  const ip = clientIp(h.get("x-forwarded-for"));
  if (!rateLimit(`lead:${ip}`, { max: 5, windowMs: 10 * 60_000 }).ok) {
    return { error: "Слишком много заявок. Попробуйте позже или напишите нам напрямую." };
  }

  const db = await getDb();

  // Only accept a course the visitor could actually have seen.
  let courseId: number | null = null;
  let courseTitle: string | null = null;
  const parsed = Number.parseInt(courseIdRaw, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    const [c] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(
        and(eq(courses.id, parsed), eq(courses.isPublished, true), eq(courses.isArchived, false)),
      )
      .limit(1);
    courseId = c?.id ?? null;
    courseTitle = c?.title ?? null;
  }

  // Never let a DB hiccup take down the storefront's main conversion path.
  try {
    await db.insert(leads).values({ name, contact, comment, courseId });
  } catch (err) {
    console.error("[submitLead] insert failed:", err);
    return {
      error: "Не удалось отправить заявку. Попробуйте ещё раз или напишите нам напрямую.",
    };
  }

  // A lead nobody looks at is a lost sale, so ping the owner. Sent AFTER the
  // response: mail latency never delays the visitor, and a dead provider can
  // never turn a saved lead into an error on screen.
  after(async () => {
    const fields: [string, string][] = [
      ["Имя", name],
      ["Контакт", contact],
      ["Курс", courseTitle ?? "не указан"],
      ["Комментарий", comment || "—"],
    ];
    try {
      await sendEmail({
        to: OWNER_NOTIFY_EMAIL,
        // Name is visitor-controlled: keep line breaks out of a header field.
        subject: `Новая заявка с сайта — ${name.replace(/\s+/g, " ")}`,
        text: `${fields.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nВсе заявки: ${ADMIN_LEADS_URL}`,
        html: emailLayout(
          "Новая заявка с сайта",
          `${fields
            .map(
              ([k, v]) =>
                `<p style="margin:0 0 10px"><strong style="color:#f4f2ec">${k}:</strong> ${esc(v)}</p>`,
            )
            .join("")}
           <p style="margin:20px 0 0"><a href="${ADMIN_LEADS_URL}" style="display:inline-block;background:#f5a524;color:#1a1206;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Открыть заявки</a></p>`,
        ),
      });
    } catch (err) {
      console.error("[submitLead] owner notification failed:", err);
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  return { ok: true };
}
