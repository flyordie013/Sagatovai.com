import { sql } from "drizzle-orm";
import { getDb } from "@/db";

/** Liveness/readiness probe: 200 only when the DB answers. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
