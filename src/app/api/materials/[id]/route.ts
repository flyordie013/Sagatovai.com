import { open } from "node:fs/promises";
import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessonMaterials } from "@/db/schema";
import { apiAccess } from "@/lib/api-access";
import { isStaff } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { materialPath } from "@/lib/material-storage";
import { UUID_PATTERN } from "@/lib/material-policy";
import { byteRange } from "@/lib/byte-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAccess(request);
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return new Response("Файл не найден.", { status: 404 });
  const db = await getDb();
  const [file] = await db.select().from(lessonMaterials).where(eq(lessonMaterials.id, id));
  if (!file) return new Response("Файл удалён или недоступен.", { status: 404 });
  const lesson = await getLessonForStudent(file.lessonId, auth.session.userId, isStaff(auth.session.role));
  if (!lesson?.canView) return new Response("Доступ к этому курсу не открыт.", { status: 403 });
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(materialPath(file.storageKey), "r");
    const stats = await handle.stat();
    if (!stats.isFile()) { await handle.close(); return new Response("Файл не найден.", { status: 404 }); }
    const etag = `"${file.storageKey}-${stats.size}"`;
    const headers = new Headers({
      "Content-Type": file.mimeType, "Content-Length": String(stats.size),
      "Content-Disposition": `attachment; filename="material.${file.filename.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "bin"}"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/['()*]/g, (s) => `%${s.charCodeAt(0).toString(16)}`)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes", ETag: etag,
    });
    if (request.method === "HEAD") { await handle.close(); return new Response(null, { headers }); }
    const ifRange = request.headers.get("if-range");
    const rangeHeader = ifRange !== null && ifRange.trim() !== etag ? null : request.headers.get("range");
    const range = rangeHeader === null ? undefined : byteRange(rangeHeader, stats.size);
    if (range === null) {
      await handle.close();
      headers.delete("Content-Length");
      headers.set("Content-Range", `bytes */${stats.size}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      headers.set("Content-Length", String(range.end - range.start + 1));
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${stats.size}`);
    }
    return new Response(Readable.toWeb(handle.createReadStream(range)) as ReadableStream, { status: range ? 206 : 200, headers });
  } catch { await handle?.close().catch(() => {}); return new Response("Не удалось найти файл. Сообщите поддержке название материала.", { status: 404 }); }
}
export const HEAD = GET;
