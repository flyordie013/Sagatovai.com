import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessonMaterials, lessons } from "@/db/schema";
import { apiAccess, positiveId, smallJson } from "@/lib/api-access";
import { MAX_MATERIALS, UUID_PATTERN } from "@/lib/material-policy";
import { maxMaterialBytes, removeMaterial, storeMaterial } from "@/lib/material-storage";
import { listLessonMaterials } from "@/data/materials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1800;
type Context = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => Response.json({ error }, { status });

async function context(request: Request, ctx: Context) {
  const auth = await apiAccess(request, true);
  if (auth.response) return { response: auth.response };
  const lessonId = positiveId((await ctx.params).id);
  if (!lessonId) return { response: bad("Урок не найден.", 404) };
  const db = await getDb();
  const [lesson] = await db.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) return { response: bad("Урок не найден.", 404) };
  return { db, lessonId };
}

export async function GET(request: Request, ctx: Context) {
  const c = await context(request, ctx);
  if (c.response) return c.response;
  return Response.json({ materials: await listLessonMaterials(c.lessonId), maxBytes: maxMaterialBytes(), maxCount: MAX_MATERIALS }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, ctx: Context) {
  const c = await context(request, ctx);
  if (c.response) return c.response;
  const id = request.headers.get("x-upload-id") || "";
  const replaceId = new URL(request.url).searchParams.get("replace");
  if (!UUID_PATTERN.test(id) || (replaceId && !UUID_PATTERN.test(replaceId))) return bad("Некорректный идентификатор загрузки.");
  // A retry after a lost response must not create a second attachment.
  const [existing] = await c.db.select().from(lessonMaterials).where(eq(lessonMaterials.id, id));
  if (existing) return existing.lessonId === c.lessonId ? Response.json({ ok: true }) : bad("Повторите загрузку.", 409);
  let stored: Awaited<ReturnType<typeof storeMaterial>>;
  try {
    stored = await storeMaterial(request, decodeURIComponent(request.headers.get("x-file-name") || ""));
  } catch (error) {
    return bad(error instanceof Error && !("code" in error) ? error.message : "Не удалось записать файл. Попробуйте ещё раз.");
  }
  let oldKey: string | null = null;
  try {
    const result = await c.db.transaction(async (tx) => {
      const [lesson] = await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, c.lessonId)).for("update");
      if (!lesson) throw new Error("Урок удалён. Обновите страницу.");
      const rows = await tx.select().from(lessonMaterials).where(eq(lessonMaterials.lessonId, c.lessonId));
      if (rows.some((r) => r.id === id)) return "duplicate";
      const replacing = replaceId ? rows.find((r) => r.id === replaceId) : null;
      if (replaceId && !replacing) throw new Error("Материал уже изменён. Обновите список.");
      if (!replacing && rows.length >= MAX_MATERIALS) throw new Error(`В уроке может быть не больше ${MAX_MATERIALS} файлов.`);
      if (replacing) {
        oldKey = replacing.storageKey;
        await tx.delete(lessonMaterials).where(eq(lessonMaterials.id, replacing.id));
      }
      await tx.insert(lessonMaterials).values({
        id, lessonId: c.lessonId, ...stored, title: replacing?.title || stored.filename,
        orderIndex: replacing?.orderIndex ?? Math.max(-1, ...rows.map((r) => r.orderIndex)) + 1,
      });
      return "saved";
    });
    if (result === "duplicate") await removeMaterial(stored.storageKey);
    if (oldKey) await removeMaterial(oldKey);
    return Response.json({ ok: true });
  } catch (error) {
    await removeMaterial(stored.storageKey);
    console.error("[materials] attachment failed", error instanceof Error ? error.message : "unknown");
    return bad("Не удалось прикрепить файл. Проверьте, что урок существует и лимит файлов не превышен.", 409);
  }
}

export async function PATCH(request: Request, ctx: Context) {
  const c = await context(request, ctx);
  if (c.response) return c.response;
  try {
    const input = await smallJson(request);
    const id = typeof input.id === "string" ? input.id : "";
    if (!UUID_PATTERN.test(id)) return bad("Материал не найден.", 404);
    await c.db.transaction(async (tx) => {
      await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, c.lessonId)).for("update");
      const rows = await tx.select().from(lessonMaterials).where(eq(lessonMaterials.lessonId, c.lessonId)).orderBy(asc(lessonMaterials.orderIndex), asc(lessonMaterials.createdAt), asc(lessonMaterials.id));
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) throw new Error("Материал не найден.");
      if (typeof input.title === "string") {
        const title = input.title.trim();
        if (!title || title.length > 180) throw new Error("Название: от 1 до 180 символов.");
        await tx.update(lessonMaterials).set({ title }).where(eq(lessonMaterials.id, id));
      } else if (input.direction === "up" || input.direction === "down") {
        const next = index + (input.direction === "up" ? -1 : 1);
        if (!rows[next]) return;
        [rows[index], rows[next]] = [rows[next], rows[index]];
        for (const [orderIndex, row] of rows.entries()) await tx.update(lessonMaterials).set({ orderIndex }).where(eq(lessonMaterials.id, row.id));
      } else throw new Error("Неизвестное действие.");
    });
    return Response.json({ ok: true });
  } catch { return bad("Не удалось сохранить. Проверьте название и обновите список."); }
}

export async function DELETE(request: Request, ctx: Context) {
  const c = await context(request, ctx);
  if (c.response) return c.response;
  try {
    const { id } = await smallJson(request);
    if (typeof id !== "string" || !UUID_PATTERN.test(id)) return bad("Материал не найден.", 404);
    const deleted = await c.db.transaction(async (tx) => {
      await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, c.lessonId)).for("update");
      return tx.delete(lessonMaterials).where(and(eq(lessonMaterials.id, id), eq(lessonMaterials.lessonId, c.lessonId))).returning({ key: lessonMaterials.storageKey });
    });
    if (!deleted.length) return bad("Материал уже удалён.", 404);
    await removeMaterial(deleted[0].key);
    return Response.json({ ok: true });
  } catch { return bad("Не удалось удалить файл. Повторите действие.", 500); }
}
