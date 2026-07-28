import { requireUser } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { videoSize, readVideoRange } from "@/lib/storage";

/**
 * Streams a lesson's uploaded video, enforcing the SAME access rules as the
 * lesson page: the student must own the course (or the lesson is a free
 * preview) and the sequential gate must be open. Files live outside `public/`
 * precisely so they can never be fetched without passing through here.
 *
 * Implements HTTP Range so seeking works and Safari plays at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHUNK = 1024 * 1024; // 1 MB per ranged response

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await requireUser();

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isInteger(lessonId)) return new Response("Bad request", { status: 400 });

  const info = await getLessonForStudent(lessonId, userId);
  if (!info || !info.lesson.videoKey) return new Response("Not found", { status: 404 });
  if (!info.canView || !info.unlocked) return new Response("Forbidden", { status: 403 });

  const key = info.lesson.videoKey;
  const size = await videoSize(key);
  if (size === null) return new Response("Not found", { status: 404 });

  const contentType = info.lesson.videoMimeType || "video/mp4";
  const range = request.headers.get("range");

  // Full-file request (some browsers probe this first).
  if (!range) {
    const stream = await readVideoRange(key, 0, size - 1);
    if (!stream) return new Response("Not found", { status: 404 });
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!match) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }

  const startRaw = match[1];
  const endRaw = match[2];
  let start = startRaw ? Number.parseInt(startRaw, 10) : 0;
  let end = endRaw ? Number.parseInt(endRaw, 10) : Math.min(start + CHUNK - 1, size - 1);

  // Suffix form: "bytes=-500" means the last 500 bytes.
  if (!startRaw && endRaw) {
    const suffix = Number.parseInt(endRaw, 10);
    start = Math.max(0, size - suffix);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response("Range not satisfiable", {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  }
  end = Math.min(end, size - 1);

  const stream = await readVideoRange(key, start, end);
  if (!stream) return new Response("Not found", { status: 404 });

  return new Response(stream, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
    },
  });
}
