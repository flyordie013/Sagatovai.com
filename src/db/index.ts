import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { Sql } from "postgres";
import * as schema from "./schema";

/**
 * Database client (Drizzle).
 *
 * - No DATABASE_URL  → embedded Postgres via **PGlite** (persisted to ./.pglite),
 *   auto-migrated and seeded on first access. Zero-config local development.
 * - DATABASE_URL set → hosted Postgres via postgres-js (Neon / Supabase / RDS).
 *   Run `pnpm db:migrate` to apply migrations there.
 *
 * A single init promise is cached on globalThis to survive HMR and to avoid
 * racing initialization across concurrent requests.
 */
export type DB = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __oquDb?: Promise<DB> };

/**
 * Applies any `drizzle/*.sql` files this database hasn't seen yet, tracking
 * them in `_migrations` so later migrations reach existing dev databases.
 * (Hosted Postgres uses `pnpm db:migrate` instead.)
 */
async function runMigrations(client: PGlite): Promise<void> {
  await client.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const dir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  const appliedRows = await client.query<{ name: string }>("SELECT name FROM _migrations");
  const applied = new Set(appliedRows.rows.map((r) => r.name));

  // Databases created before migration tracking existed already contain the
  // initial schema — record it as applied instead of re-running it.
  if (applied.size === 0) {
    const legacy = await client.query<{ t: string | null }>(
      "SELECT to_regclass('public.courses') AS t",
    );
    if (legacy.rows[0]?.t && files.length > 0) {
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [files[0]]);
      applied.add(files[0]);
    }
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await client.exec(sql);
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
  }
}

/**
 * Applies pending `drizzle/*.sql` migrations to a hosted Postgres on boot, so a
 * fresh container just needs to start (no separate migrate step). Serialized
 * across instances with an advisory lock. Set RUN_MIGRATIONS=false to opt out
 * and run `pnpm db:migrate` manually instead.
 */
async function runMigrationsPg(sql: Sql): Promise<void> {
  // Acquire the lock FIRST (it's a pure integer lock, needs no table), so even
  // creating _migrations is serialized across concurrent cold boots.
  await sql`SELECT pg_advisory_lock(48729)`;
  try {
    await sql.unsafe(
      `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const dir = path.join(process.cwd(), "drizzle");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const appliedRows = await sql<{ name: string }[]>`SELECT name FROM _migrations`;
    const applied = new Set(appliedRows.map((r) => r.name));

    // Adopt a pre-tracking database: if the schema already exists, mark the
    // initial migration applied instead of re-running it.
    if (applied.size === 0 && files.length > 0) {
      const legacy = await sql<{ t: string | null }[]>`SELECT to_regclass('public.courses') AS t`;
      if (legacy[0]?.t) {
        await sql`INSERT INTO _migrations (name) VALUES (${files[0]})`;
        applied.add(files[0]);
      }
    }

    for (const file of files) {
      if (applied.has(file)) continue;
      const raw = await readFile(path.join(dir, file), "utf8");
      const statements = raw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      await sql.begin(async (tx) => {
        for (const stmt of statements) await tx.unsafe(stmt);
        await tx`INSERT INTO _migrations (name) VALUES (${file})`;
      });
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(48729)`;
  }
}

/**
 * Creates the first superadmin from BOOTSTRAP_OWNER_* env vars — but ONLY when
 * no superadmin exists yet. Idempotent (safe to leave the vars set), so a fresh
 * deploy is self-bootstrapping with zero manual steps. `pnpm db:bootstrap`
 * remains available for those who prefer an explicit step.
 */
async function bootstrapOwner(sql: Sql): Promise<void> {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (!email || !password) return;
  if (!email.includes("@") || password.length < 10) {
    console.error("[bootstrap] BOOTSTRAP_OWNER_EMAIL/PASSWORD invalid — skipping.");
    return;
  }

  const existing = await sql`SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1`;
  if (existing.length > 0) return;

  const { hashPassword } = await import("../lib/password-hash");
  const hash = await hashPassword(password);
  const name = process.env.BOOTSTRAP_OWNER_NAME?.trim() || "Владелец платформы";
  await sql`
    INSERT INTO profiles (full_name, email, role, password_hash, rank)
    VALUES (${name}, ${email}, 'superadmin', ${hash}, 'Основатель')
    ON CONFLICT (email) DO NOTHING`;
  console.info(`[bootstrap] created superadmin ${email}`);
}

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;

  // Drivers are imported dynamically so a production build never loads PGlite's
  // WASM at runtime (postgres-js path) and vice-versa — keeps the two runtimes
  // cleanly separated and avoids bundling surprises in standalone/Docker.
  if (url) {
    const { drizzle: drizzlePg } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 5 });
    if (process.env.RUN_MIGRATIONS !== "false") await runMigrationsPg(client);
    await bootstrapOwner(client);
    return drizzlePg(client, { schema }) as unknown as DB;
  }

  // PGlite is a DEVELOPMENT-ONLY convenience: it stores data on the local
  // filesystem (wiped on every redeploy) and seeds demo accounts with known
  // passwords. Booting it in production would silently destroy customer data
  // and expose a demo superadmin, so refuse loudly instead.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL is required in production. The embedded PGlite database is " +
        "development-only: it loses all data on redeploy and seeds demo accounts. " +
        "Provision a managed Postgres, set DATABASE_URL, run `pnpm db:migrate`, " +
        "then `pnpm db:bootstrap` to create the first owner.",
    );
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { seedIfEmpty } = await import("./seed");
  const client = new PGlite(process.env.PGLITE_DIR || path.join(process.cwd(), ".pglite"));
  await runMigrations(client);
  const db = drizzlePglite(client, { schema });
  await seedIfEmpty(db);
  return db;
}

export function getDb(): Promise<DB> {
  // Don't cache a REJECTED init promise — a transient boot error (DB hiccup,
  // migration blip) would otherwise wedge the process at 503 forever. Clear the
  // cache on failure so the next call retries.
  if (!globalForDb.__oquDb) {
    globalForDb.__oquDb = init().catch((err) => {
      globalForDb.__oquDb = undefined;
      throw err;
    });
  }
  return globalForDb.__oquDb;
}
