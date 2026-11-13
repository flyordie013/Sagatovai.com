/**
 * Removes orphaned uploaded video files — any file in storage/videos/ that no
 * lesson references. Delete-hooks in the admin actions already free files as
 * content is removed; this is a safety net for files orphaned before that, or
 * by a crash mid-delete.
 *
 * Usage (against the production DB):
 *   DATABASE_URL='postgresql://…' pnpm db:gc-videos          # dry run
 *   DATABASE_URL='postgresql://…' pnpm db:gc-videos --delete # actually delete
 */
import { readdir, unlink, stat } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

// Never touch a file younger than this — an upload streams to its final name
// (up to ~300s / 2GB) BEFORE the DB references it, so a fresh unreferenced file
// may just be an in-flight upload, not an orphan.
const MIN_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL is required.");
    process.exit(1);
  }
  const doDelete = process.argv.includes("--delete");
  const sql = postgres(url, { max: 1 });
  try {
  for (const kind of ["videos", "materials"] as const) {
  const dir = path.join(process.cwd(), "storage", kind);

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    console.log(`storage/${kind} is empty or missing — nothing to do.`);
    continue;
  }

    const rows = kind === "videos"
      ? await sql<{ key: string }[]>`SELECT video_key AS key FROM lessons WHERE video_key IS NOT NULL`
      : await sql<{ key: string }[]>`SELECT storage_key AS key FROM lesson_materials`;
    const referenced = new Set(rows.map((r) => r.key));
    const now = Date.now();

    // Orphan = not referenced AND old enough to not be an in-flight upload.
    const orphans: string[] = [];
    let tooNew = 0;
    for (const f of files) {
      if (referenced.has(f)) continue;
      const s = await stat(path.join(dir, f)).catch(() => null);
      if (!s?.isFile()) continue;
      if (now - s.mtimeMs < MIN_AGE_MS) {
        tooNew += 1; // recently written — could be an active upload, skip
        continue;
      }
      orphans.push(f);
    }

    console.log(
      `${kind}: ${files.length} files, ${referenced.size} referenced, ${orphans.length} orphaned` +
        (tooNew ? `, ${tooNew} too new to touch` : "") +
        ".",
    );
    for (const f of orphans) {
      if (doDelete) {
        await unlink(path.join(dir, f)).catch(() => {});
        console.log(`  deleted ${f}`);
      } else {
        console.log(`  would delete ${f}`);
      }
    }
    if (orphans.length > 0 && !doDelete) {
      console.log("\nDry run — re-run with --delete to remove them.");
    }
  }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("✗ gc-videos failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
