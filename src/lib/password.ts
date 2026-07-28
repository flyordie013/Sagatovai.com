import "server-only";

/**
 * Server-only re-export of the password helpers. The implementation lives in
 * `./password-hash` so deploy scripts can reuse the exact same hash format
 * without tripping the `server-only` guard.
 */
export { hashPassword, verifyPassword } from "./password-hash";
