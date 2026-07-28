import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessons } from "@/db/schema";
import { requireStaff } from "@/lib/session";
import {
  putVideo,
  deleteVideo,
  isAllowedVideoType,
  allowedVideoTypes,
  maxVideoBytes,
} from "@/lib/storage";

/**
 * Video upload for a lesson. A Route Handler (not a Server Action) because
 * Server Actions cap the request body at ~1 MB, which no video clears.
 * The proxy matcher skips `/api`, so this authenticates on its own.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Large uploads take a while; give the route room where the host honours it.
export const maxDuration = 300;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isInteger(lessonId)) return bad("Некорректный урок");

  const mimeType = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!isAllowedVideoType(mimeType)) {
    return bad(
      `Неподдерживаемый формат. Разрешены: ${allowedVideoTypes().join(", ")}`,
      415,
    );
  }

  const declared = Number.parseInt(request.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxVideoBytes()) {
    return bad("Файл слишком большой", 413);
  }
  if (!request.body) return bad("Пустой запрос");

  const db = await getDb();
  const [lesson] = await db
    .select({ id: lessons.id, videoKey: lessons.videoKey })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return bad("Урок не найден", 404);

  let stored;
  try {
    stored = await putVideo(request.body, mimeType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "TOO_LARGE") return bad("Файл слишком большой", 413);
    if (msg === "EMPTY") return bad("Файл пустой");
    console.error("[video upload] failed:", err);
    return bad("Не удалось сохранить файл", 500);
  }

  await db
    .update(lessons)
    .set({
      videoKey: stored.key,
      videoSizeBytes: stored.size,
      videoMimeType: stored.mimeType,
      videoUrl: null, // an upload replaces any external link
    })
    .where(eq(lessons.id, lessonId));

  // Free the previous file only after the row points at the new one.
  if (lesson.videoKey) await deleteVideo(lesson.videoKey);

  return Response.json({ ok: true, size: stored.size });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireStaff();

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isInteger(lessonId)) return bad("Некорректный урок");

  const db = await getDb();
  const [lesson] = await db
    .select({ videoKey: lessons.videoKey })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1);
  if (!lesson) return bad("Урок не найден", 404);

  await db
    .update(lessons)
    .set({ videoKey: null, videoSizeBytes: null, videoMimeType: null })
    .where(eq(lessons.id, lessonId));
  if (lesson.videoKey) await deleteVideo(lesson.videoKey);

  return Response.json({ ok: true });
}
