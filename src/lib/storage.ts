import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

/** Reject keys that try to escape the video directory. */
function resolveKey(key: string): string | null {
  if (!key || key.includes("/") || key.includes("\\") || key.includes("..")) return null;
  return path.join(VIDEO_DIR, key);
}

export interface StoredVideo {
  key: string;
  size: number;
  mimeType: string;
}

/** Streams an upload to disk. Returns the storage key. */
export async function putVideo(
  body: ReadableStream<Uint8Array>,
  mimeType: string,
): Promise<StoredVideo> {
  const ext = ALLOWED_MIME.get(mimeType);
  if (!ext) throw new Error(`Unsupported video type: ${mimeType}`);

  await mkdir(VIDEO_DIR, { recursive: true });
  const key = `${randomUUID()}.${ext}`;
  const dest = path.join(VIDEO_DIR, key);
  const limit = maxVideoBytes();

  // Buffer-free streaming write, aborting if the client exceeds the limit.
  const out = createWriteStream(dest);
  let size = 0;

  try {
    const reader = body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        reader.cancel().catch(() => {});
        throw new Error("TOO_LARGE");
      }
      if (!out.write(value)) {
        await new Promise<void>((resolve) => out.once("drain", () => resolve()));
      }
    }
    await new Promise<void>((resolve, reject) => {
      out.end(() => resolve());
      out.once("error", reject);
    });
  } catch (err) {
    out.destroy();
    await unlink(dest).catch(() => {});
    throw err;
  }

  if (size === 0) {
    await unlink(dest).catch(() => {});
    throw new Error("EMPTY");
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
  const nodeStream = createReadStream(file, { start, end });
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

export async function deleteVideo(key: string): Promise<void> {
  const file = resolveKey(key);
  if (!file) return;
  await unlink(file).catch(() => {});
}

