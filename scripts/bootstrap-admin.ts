/**
 * Creates the first superadmin in a hosted Postgres database.
 *
 * The demo seed (src/db/seed.ts) is development-only, so a freshly migrated
 * production database has zero rows in `profiles` — nobody, not even the owner,
 * could log in. This script is the one-time bootstrap that fixes that.
 *
 * Usage:
 *   DATABASE_URL='postgresql://…' \
 *   OWNER_EMAIL='you@example.com' \
 *   OWNER_PASSWORD='<a long unique password>' \
 *   pnpm db:bootstrap
 *
 * Run `pnpm db:migrate` first so the tables exist.
 */
import postgres from "postgres";
import { hashPassword } from "../src/lib/password-hash";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  const fullName = process.env.OWNER_NAME?.trim() || "Владелец платформы";

  if (!url) fail("DATABASE_URL is required.");
  if (!email) fail("OWNER_EMAIL is required.");
  if (!email.includes("@")) fail("OWNER_EMAIL does not look like an email address.");
  if (!password) fail("OWNER_PASSWORD is required.");
  if (password.length < 10) fail("OWNER_PASSWORD must be at least 10 characters.");

  const sql = postgres(url, { max: 1 });
  try {
    const tableCheck = await sql<{ t: string | null }[]>`
      SELECT to_regclass('public.profiles') AS t`;
    if (!tableCheck[0]?.t) {
      fail("Table `profiles` does not exist. Run `pnpm db:migrate` first.");
    }

    const existing = await sql<{ id: string; role: string }[]>`
      SELECT id, role FROM profiles WHERE email = ${email} LIMIT 1`;
    if (existing.length > 0) {
      fail(
        `A profile with ${email} already exists (role: ${existing[0].role}). ` +
          "Refusing to overwrite it.",
      );
    }

    const passwordHash = await hashPassword(password);
    const [row] = await sql<{ id: string }[]>`
      INSERT INTO profiles (full_name, email, role, password_hash, rank)
      VALUES (${fullName}, ${email}, 'superadmin', ${passwordHash}, 'Основатель')
      RETURNING id`;

    console.log(`✓ Superadmin created: ${email}`);
    console.log(`  id: ${row.id}`);
    console.log("  Log in at /login, then open /admin.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ Bootstrap failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
