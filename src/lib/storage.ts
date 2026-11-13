import "server-only";
import { createWriteStream } from "node:fs";
import { mkdir, open, stat, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { Readable } from "node:stream";

/**
 * Media storage seam.
 *
 * Today: files live on the server's own disk under `storage/` (outside `public/`
 * so nothing is served without an access check). The whole app talks to this
 * module only, so moving to S3-compatible object storage (Cloudflare R2, AWS S3,
 * a KZ provider) later means implementing these four functions — no call site
 * changes.
 *
 * IMPORTANT: local disk requires a server with a persistent filesystem (a VPS).
 * On ephemeral/serverless hosts the files vanish on redeploy.
 */

const ROOT = path.join(process.cwd(), "storage");
const VIDEO_DIR = path.join(ROOT, "videos");

const ALLOWED_MIME = new Map<string, string>([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
  ["video/quicktime", "mov"],
  ["video/x-matroska", "mkv"],
]);

export function isAllowedVideoType(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

export function allowedVideoTypes(): string[] {
  return [...ALLOWED_MIME.keys()];
}

/** Max upload size, overridable via MAX_VIDEO_MB (default 2 GB). */
export function maxVideoBytes(): number {
  const mb = Number.parseInt(process.env.MAX_VIDEO_MB ?? "", 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 2048) * 1024 * 1024;
}

/**
 * Head-room the uploader refuses to eat into. Postgres and the OS live on the
 * same VPS disk as the videos: a filesystem filled to the last byte doesn't
 * just break one upload, it takes the database (and the site) down with it.
 * Overridable via MIN_FREE_DISK_MB.
 */
function diskReserveBytes(): number {
  const mb = Number.parseInt(process.env.MIN_FREE_DISK_MB ?? "", 10);
  return (Number.isFinite(mb) && mb > 0 ? mb : 512) * 1024 * 1024;
}

/** How often the disk is re-checked mid-upload (Content-Length can lie). */
const SPACE_CHECK_EVERY_BYTES = 64 * 1024 * 1024;

/** Reject keys that try to escape the video directory. */
function resolveKey(key: string): string | null {
  if (!key || key.includes("/") || key.includes("\\") || key.includes("..")) return null;
  return path.join(VIDEO_DIR, key);
}

/**
 * Upload failure that has something to say to the person who started it.
 * `message` stays the machine code so callers matching on it keep working;
 * `userMessage` is the Russian line to show, `status` the HTTP code to use.
 */
export class StorageError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly status: number;

  constructor(code: string, userMessage: string, status: number, cause?: unknown) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = "StorageError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = status;
  }
}

/** Free bytes on the storage filesystem, or null when it can't be measured. */
async function freeDiskBytes(): Promise<number | null> {
  try {
    const s = await statfs(VIDEO_DIR);
    return s.bsize * s.bavail;
  } catch {
    // Exotic filesystem or a container without statfs — fall back to catching
    // ENOSPC at write time.
    return null;
  }
}

function outOfSpaceError(free: number | null, cause?: unknown): StorageError {
  const freeMb = free === null ? "?" : Math.floor(free / (1024 * 1024));
  console.error(
    `[storage] out of disk space: ${freeMb} MB free, ` +
      `${Math.floor(diskReserveBytes() / (1024 * 1024))} MB must stay free`,
  );
  return new StorageError(
    "NO_SPACE",
    "На сервере закончилось место. Освободите место на диске и попробуйте снова.",
    507,
    cause,
  );
}

/** ENOSPC (disk full) and EDQUOT (quota exhausted) mean the same thing here. */
function isOutOfSpace(err: unknown): boolean {
  const code = (err as NodeJS.ErrnoException | null)?.code;
  return code === "ENOSPC" || code === "EDQUOT";
}

export interface StoredVideo {
  key: string;
  size: number;
  mimeType: string;
}

/**
 * Streams an upload to disk. Returns the storage key.
 *
 * `expectedBytes` (the request's Content-Length, when the client sent one) lets
 * the write be refused before it starts if the disk plainly cannot hold it.
 */
export async function putVideo(
  body: ReadableStream<Uint8Array>,
  mimeType: string,
  expectedBytes?: number,
): Promise<StoredVideo> {
  const ext = ALLOWED_MIME.get(mimeType);
  if (!ext) throw new Error(`Unsupported video type: ${mimeType}`);

  await mkdir(VIDEO_DIR, { recursive: true });

  // Refuse before the first byte when the disk clearly can't take the file: a
  // clear "no space" now beats a half-written file and a wedged upload.
  const reserve = diskReserveBytes();
  const planned =
    expectedBytes !== undefined && Number.isFinite(expectedBytes) && expectedBytes > 0
      ? expectedBytes
      : 0;
  const freeBefore = await freeDiskBytes();
  if (freeBefore !== null && freeBefore < planned + reserve) throw outOfSpaceError(freeBefore);

  const key = `${randomUUID()}.${ext}`;
  const dest = path.join(VIDEO_DIR, key);
  const limit = maxVideoBytes();

  // Buffer-free streaming write, aborting if the client exceeds the limit.
  const out = createWriteStream(dest);
  const reader = body.getReader();
  let size = 0;
  let spaceCheckedAt = 0;

  // A write can fail at any moment (a full disk being the likely reason). The
  // stream reports that asynchronously: without a listener Node turns it into
  // an uncaught exception, and a pending "drain" wait would never settle — the
  // upload would hang forever. Racing every await against this promise turns
  // the failure into a normal rejection instead.
  const writeFailed = new Promise<never>((_resolve, reject) => {
    out.on("error", reject);
  });
  writeFailed.catch(() => {}); // handled below; keep Node from flagging it

  try {
    // Wait for creation before reading: an immediately aborted request must not
    // unlink a not-yet-created path and leave an orphan when open finishes.
    await Promise.race([once(out, "open"), writeFailed]);
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), writeFailed]);
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        throw new StorageError("TOO_LARGE", "Файл слишком большой", 413);
      }
      if (!out.write(value)) {
        await Promise.race([once(out, "drain"), writeFailed]);
      }
      // Content-Length can be absent or a lie, so watch the disk as we go.
      if (size - spaceCheckedAt >= SPACE_CHECK_EVERY_BYTES) {
        spaceCheckedAt = size;
        const free = await freeDiskBytes();
        if (free !== null && free < reserve) throw outOfSpaceError(free);
      }
    }
    await Promise.race([new Promise<void>((resolve) => out.end(() => resolve())), writeFailed]);
  } catch (err) {
    out.destroy();
    reader.cancel().catch(() => {});
    // The partial file must go: it occupies exactly the space we just ran out
    // of, and nothing will ever reference it.
    await unlink(dest).catch(() => {});
    throw isOutOfSpace(err) ? outOfSpaceError(await freeDiskBytes(), err) : err;
  }

  if (size === 0) {
    await unlink(dest).catch(() => {});
    throw new StorageError("EMPTY", "Файл пустой", 400);
  }

  return { key, size, mimeType };
}

export interface VideoRange {
  start: number;
  end: number;
  size: number;
  stream: ReadableStream<Uint8Array>;
}

/** Size of a stored video, or null when the key is unknown/invalid. */
export async function videoSize(key: string): Promise<number | null> {
  const file = resolveKey(key);
  if (!file) return null;
  try {
    const s = await stat(file);
    return s.isFile() ? s.size : null;
  } catch {
    return null;
  }
}

/**
 * Opens a byte range of a stored video. Range support is what makes seeking
 * (and Safari playback) work at all.
 */
export async function readVideoRange(
  key: string,
  start: number,
  end: number,
): Promise<ReadableStream<Uint8Array> | null> {
  const file = resolveKey(key);
  if (!file) return null;
  try {
    // Hold the descriptor even if an administrator replaces the file mid-stream.
    const handle = await open(file, "r");
    return Readable.toWeb(handle.createReadStream({ start, end })) as ReadableStream<Uint8Array>;
  } catch { return null; }
}

export async function deleteVideo(key: string): Promise<void> {
  const file = resolveKey(key);
  if (!file) return;
  await unlink(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") console.error("[storage] video cleanup failed", error.code);
  });
}

