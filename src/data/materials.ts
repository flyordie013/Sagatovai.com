import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { lessonMaterials } from "@/db/schema";

export const materialFields = {
  id: lessonMaterials.id, title: lessonMaterials.title, filename: lessonMaterials.filename,
  mimeType: lessonMaterials.mimeType, sizeBytes: lessonMaterials.sizeBytes, orderIndex: lessonMaterials.orderIndex,
};
export async function listLessonMaterials(lessonId: number) {
  const db = await getDb();
  return db.select(materialFields).from(lessonMaterials).where(eq(lessonMaterials.lessonId, lessonId))
    .orderBy(asc(lessonMaterials.orderIndex), asc(lessonMaterials.createdAt), asc(lessonMaterials.id));
}
export type LessonMaterial = Awaited<ReturnType<typeof listLessonMaterials>>[number];
