import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Pure password hashing (scrypt). Deliberately free of the `server-only` guard
 * so standalone Node scripts (e.g. scripts/bootstrap-admin.ts) can produce
 * hashes in exactly the same format the app verifies. App code should import
 * `@/lib/password` instead, which re-exports these behind the server-only guard.
 */

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Hash a password as `salt:derivedKey` (scrypt). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time verification against a stored `salt:derivedKey`. */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, "hex");
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  if (keyBuf.length !== derived.length) return false;
  return timingSafeEqual(keyBuf, derived);
}
