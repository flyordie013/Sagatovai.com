import { requireUser, isStaff } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";
import { videoSize, readVideoRange } from "@/lib/storage";

/**
 * Streams a lesson's uploaded video, enforcing the SAME access rules as the
 * lesson page: the student must have explicit course access (staff may preview).
 * Files live outside `public/`
 * precisely so they can never be fetched without passing through here.
 *
 * Implements HTTP Range so seeking works and Safari plays at all.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bytes returned for an open-ended range (`bytes=N-`) — the form players
 * actually send while they buffer ahead.
 *
 * At 1 MB a 150 MB lesson cost ~150 separate requests, and on a mobile network
 * it is the per-request latency, not the bandwidth, that starves the buffer.
 * 4 MB is roughly 20-30 seconds of a sanely encoded lesson: the buffer stays
 * comfortably ahead of playback, the same lesson now takes ~38 requests, and a
 * seek the student abandons wastes at most 4 MB of their traffic. Answering an
 * open range with the whole file would remove the last limit and make every
 * skip download the rest of the lesson.
 */
const CHUNK = 4 * 1024 * 1024;

/**
 * The browser may keep the bytes, but it must ask us before replaying them.
 *
 * `max-age=0, must-revalidate` is deliberate: access can be revoked at any
 * moment (a declined request, a locked enrollment, an archived course), and a
 * non-zero max-age would let a student whose access is gone keep watching from
 * their own cache without a single request reaching this handler. Revalidating
 * costs nothing in bandwidth — the ETag below turns the check into a 304 with
 * no body, so a re-watch still avoids re-downloading the file. `private` keeps
 * the copy out of shared/CDN caches.
 */
const CACHE_CONTROL = "private, max-age=0, must-revalidate";

/**
 * Strong validator. Storage keys are per-upload UUIDs, so replacing a lesson's
 * video changes the ETag; strong (not weak) matters because `If-Range` may only
 * be used to resume a partial download against a strong one.
 */
function etagFor(key: string, size: number): string {
  return `"${key}-${size}"`;
}

/** `If-None-Match` is a comma-separated list, or `*`; comparison is weak. */
function ifNoneMatch(header: string | null, etag: string): boolean {
  if (!header) return false;
  const value = header.trim();
  if (value === "*") return true;
  return value.split(",").some((candidate) => candidate.trim().replace(/^W\//, "") === etag);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, role } = await requireUser();

  const { id } = await params;
  const lessonId = Number.parseInt(id, 10);
  if (!Number.isInteger(lessonId)) return new Response("Bad request", { status: 400 });

  const info = await getLessonForStudent(lessonId, userId, isStaff(role));
  if (!info || !info.lesson.videoKey) return new Response("Not found", { status: 404 });
  if (!info.canView) return new Response("Forbidden", { status: 403 });

  const key = info.lesson.videoKey;
  const size = await videoSize(key);
  if (size === null) return new Response("Not found", { status: 404 });

  const contentType = info.lesson.videoMimeType || "video/mp4";
  const etag = etagFor(key, size);

  // The student already holds this exact file: answer with headers only. Access
  // was re-checked above, so a revoked student still stops getting the video.
  if (ifNoneMatch(request.headers.get("if-none-match"), etag)) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": CACHE_CONTROL,
        "Accept-Ranges": "bytes",
      },
    });
  }

  // A stale `If-Range` means the cached head belongs to a previous upload —
  // continuing it would splice two different videos together, so start over.
  const ifRange = request.headers.get("if-range");
  const range = ifRange !== null && ifRange.trim() !== etag ? null : request.headers.get("range");

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
        ETag: etag,
        "Cache-Control": CACHE_CONTROL,
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
      ETag: etag,
      "Cache-Control": CACHE_CONTROL,
    },
  });
}
