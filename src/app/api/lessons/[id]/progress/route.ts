import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { lessonProgress } from "@/db/schema";
import { apiAccess, positiveId, smallJson } from "@/lib/api-access";
import { isStaff } from "@/lib/session";
import { getLessonForStudent } from "@/data/course";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAccess(request);
  if (auth.response) return auth.response;
  const lessonId = positiveId((await params).id);
  if (!lessonId) return new Response(null, { status: 404 });
  const lesson = await getLessonForStudent(lessonId, auth.session.userId, isStaff(auth.session.role));
  if (!lesson?.canView) return new Response(null, { status: 403 });
  try {
    const data = await smallJson(request);
    if (![data.position, data.pct, data.capturedAt].every(v => typeof v === "number")) return new Response(null, { status: 400 });
    const position = Number(data.position), pct = Number(data.pct), capturedAt = Number(data.capturedAt);
    if (![position, pct, capturedAt].every(Number.isFinite) || position < 0 || position > 43200 || pct < 0 || pct > 100 || capturedAt < 1 || capturedAt > Date.now() + 60000) return new Response(null, { status: 400 });
    const db = await getDb();
    const values = { userId: auth.session.userId, lessonId, lastPositionSec: Math.floor(position), watchedPct: Math.round(pct), positionUpdatedAt: new Date(capturedAt), updatedAt: new Date() };
    await db.insert(lessonProgress).values(values).onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        lastPositionSec: sql`case when ${lessonProgress.positionUpdatedAt} is null or ${lessonProgress.positionUpdatedAt} <= ${values.positionUpdatedAt.toISOString()}::timestamptz then ${values.lastPositionSec} else ${lessonProgress.lastPositionSec} end`,
        positionUpdatedAt: sql`greatest(${lessonProgress.positionUpdatedAt}, ${values.positionUpdatedAt.toISOString()}::timestamptz)`,
        watchedPct: sql`greatest(${lessonProgress.watchedPct}, ${values.watchedPct})`, updatedAt: values.updatedAt,
      }, setWhere: eq(lessonProgress.userId, values.userId),
    });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Не удалось сохранить позицию." }, { status: 400 }); }
}
