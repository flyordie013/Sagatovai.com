import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessons } from "@/db/schema";
import { apiAccess, positiveId } from "@/lib/api-access";
import {
  putVideo,
  deleteVideo,
  StorageError,
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
export const maxDuration = 1800;

/** Nothing plausible for a lesson runs longer than this. */
const MAX_DURATION_SEC = 12 * 60 * 60;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

/**
 * Length the browser measured from the file before uploading. Untrusted input,
 * so anything that is not a sane whole number of seconds is dropped.
 */
function parseDuration(raw: string | null): number | null {
  const sec = Number(raw);
  if (!Number.isInteger(sec) || sec <= 0 || sec > MAX_DURATION_SEC) return null;
  return sec;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiAccess(request, true);
  if (auth.response) return auth.response;

  const { id } = await params;
  const lessonId = positiveId(id);
  if (!lessonId) return bad("Некорректный урок");

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
    // Passing the declared size lets storage refuse up front when the disk
    // cannot fit the file, instead of dying halfway through the write.
    stored = await putVideo(
      request.body,
      mimeType,
      Number.isFinite(declared) ? declared : undefined,
    );
  } catch (err) {
    // Disk full and friends already carry a Russian message for the owner.
    if (err instanceof StorageError) return bad(err.userMessage, err.status);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "TOO_LARGE") return bad("Файл слишком большой", 413);
    if (msg === "EMPTY") return bad("Файл пустой");
    console.error("[video upload] failed:", err);
    return bad("Не удалось сохранить файл", 500);
  }

  const durationSec = parseDuration(request.headers.get("x-video-duration"));

  let previousKey: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ videoKey: lessons.videoKey }).from(lessons).where(eq(lessons.id, lessonId)).for("update");
      if (!current) throw new Error("Lesson deleted during upload");
      previousKey = current.videoKey;
      await tx.update(lessons).set({
        videoKey: stored.key, videoSizeBytes: stored.size, videoMimeType: stored.mimeType,
        videoUrl: null, videoDurationSec: durationSec ?? 0,
      }).where(eq(lessons.id, lessonId));
    });
  } catch (error) {
    await deleteVideo(stored.key);
    console.error("[video upload] attachment failed", error);
    return bad("Не удалось прикрепить видео. Возможно, урок удалён. Обновите страницу.", 409);
  }
  // The row lock ensures a concurrent replacement retires the actual predecessor.
  if (previousKey) await deleteVideo(previousKey);

  return Response.json({ ok: true, size: stored.size });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await apiAccess(request, true);
  if (auth.response) return auth.response;

  const { id } = await params;
  const lessonId = positiveId(id);
  if (!lessonId) return bad("Некорректный урок");

  const db = await getDb();
  const removed = await db.transaction(async (tx) => {
    const [lesson] = await tx.select({ videoKey: lessons.videoKey }).from(lessons).where(eq(lessons.id, lessonId)).for("update");
    if (!lesson) return null;
    await tx.update(lessons).set({ videoKey: null, videoSizeBytes: null, videoMimeType: null, videoDurationSec: 0 }).where(eq(lessons.id, lessonId));
    return lesson;
  });
  if (!removed) return bad("Урок не найден", 404);
  if (removed.videoKey) await deleteVideo(removed.videoKey);

  return Response.json({ ok: true });
}
