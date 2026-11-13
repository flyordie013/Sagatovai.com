import "server-only";
import { getAuthenticatedSession, isStaff } from "./session";

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL || request.url).origin;
  return origin === expected;
}

export async function apiAccess(request: Request, staff = false) {
  const session = await getAuthenticatedSession();
  if (!session) return { response: Response.json({ error: "Войдите в аккаунт, чтобы продолжить." }, { status: 401 }) };
  if (staff && !isStaff(session.role)) return { response: Response.json({ error: "Недостаточно прав." }, { status: 403 }) };
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request)) {
    return { response: Response.json({ error: "Обновите страницу и повторите действие." }, { status: 403 }) };
  }
  return { session };
}

export function positiveId(raw: string): number | null {
  const n = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function smallJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.body) throw new Error("Пустой запрос");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new Error("Слишком большой запрос"); }
    chunks.push(value);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректный запрос");
  return value;
}
