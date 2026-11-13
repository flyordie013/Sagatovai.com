import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, open, statfs, unlink } from "node:fs/promises";
import path from "node:path";
import { MATERIAL_TYPES, materialExtension, validMaterialSignature, cleanFilename } from "./material-policy";

export const MATERIAL_DIR = path.join(process.cwd(), "storage", "materials");
export function maxMaterialBytes(): number {
  const mb = Number(process.env.MAX_MATERIAL_MB || 200);
  return Math.max(1, Math.min(200, Number.isFinite(mb) ? mb : 200)) * 1024 ** 2;
}
export function materialPath(key: string): string {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(key)) throw new Error("Некорректный файл");
  return path.join(MATERIAL_DIR, key);
}
export async function removeMaterial(key: string) {
  await unlink(materialPath(key)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") console.error("[materials] cleanup failed", error.code);
  });
}
export async function storeMaterial(request: Request, rawName: string) {
  const filename = cleanFilename(rawName);
  const ext = materialExtension(filename);
  const mimeType = MATERIAL_TYPES[ext];
  if (!filename || !mimeType) throw new Error("Этот формат не поддерживается. Выберите файл из списка разрешённых.");
  if (!request.body) throw new Error("Файл пустой.");
  const limit = maxMaterialBytes();
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("Файл превышает допустимый размер.");
  await mkdir(MATERIAL_DIR, { recursive: true });
  const free = await statfs(MATERIAL_DIR);
  const reserve = Math.max(512, Number(process.env.MIN_FREE_DISK_MB) || 512) * 1024 ** 2;
  if (free.bavail * free.bsize < limit + reserve) throw new Error("На сервере недостаточно места. Обратитесь к владельцу платформы.");
  const storageKey = `${randomUUID()}.${ext}`;
  const file = await open(materialPath(storageKey), "wx", 0o600);
  const reader = request.body.getReader();
  let sizeBytes = 0;
  let checkedAt = 0;
  let prefix = Buffer.alloc(0);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      sizeBytes += value.byteLength;
      if (sizeBytes > limit) throw new Error("Файл превышает допустимый размер.");
      if (sizeBytes - checkedAt >= 8 * 1024 ** 2) {
        const space = await statfs(MATERIAL_DIR);
        if (space.bavail * space.bsize < reserve + value.byteLength) throw new Error("На сервере недостаточно места. Обратитесь к владельцу платформы.");
        checkedAt = sizeBytes;
      }
      if (prefix.length < 4096) prefix = Buffer.concat([prefix, value.subarray(0, 4096 - prefix.length)]);
      // FileHandle.write may write fewer bytes than requested.
      let offset = 0;
      while (offset < value.byteLength) {
        const { bytesWritten } = await file.write(value, offset, value.byteLength - offset);
        if (bytesWritten === 0) throw new Error("Не удалось сохранить файл.");
        offset += bytesWritten;
      }
    }
    if (!sizeBytes || !validMaterialSignature(ext, prefix)) throw new Error("Содержимое файла не соответствует формату или файл пустой.");
    await file.close();
    return { filename, mimeType, storageKey, sizeBytes };
  } catch (error) {
    await reader.cancel().catch(() => {});
    await file.close().catch(() => {});
    await removeMaterial(storageKey);
    throw error;
  }
}
