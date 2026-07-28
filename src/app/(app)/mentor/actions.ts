"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles, mentorThreads, mentorMessages } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { generateReply, type ChatMessage } from "@/lib/mentor-ai";
import { getMentorLearningContext } from "@/data/mentor";

export interface SendResult {
  ok: boolean;
  error?: string;
  threadId?: string;
  reply?: string;
}

export async function sendMessage(
  threadId: string | null,
  content: string,
): Promise<SendResult> {
  const { userId } = await requireUser();
  const text = content.trim();
  if (!text) return { ok: false, error: "Пустое сообщение" };
  if (text.length > 4000) return { ok: false, error: "Сообщение слишком длинное" };

  // The mentor is the only per-call paid action — cap it per user so a scripted
  // loop can't burn through the LLM quota. Keyed by userId (server-trusted).
  if (!rateLimit(`mentor:${userId}`, { max: 20, windowMs: 60_000 }).ok) {
    return { ok: false, error: "Слишком часто. Подождите минуту и попробуйте снова." };
  }

  const db = await getDb();

  // resolve / validate thread ownership
  let tid = threadId;
  if (tid) {
    const [owned] = await db
      .select({ id: mentorThreads.id })
      .from(mentorThreads)
      .where(and(eq(mentorThreads.id, tid), eq(mentorThreads.userId, userId)))
      .limit(1);
    if (!owned) tid = null;
  }
  if (!tid) {
    const [created] = await db
      .insert(mentorThreads)
      .values({ userId, title: text.slice(0, 48) })
      .returning({ id: mentorThreads.id });
    tid = created.id;
  }

  await db.insert(mentorMessages).values({ threadId: tid, role: "user", content: text });

  const rows = await db
    .select({ role: mentorMessages.role, content: mentorMessages.content })
    .from(mentorMessages)
    .where(eq(mentorMessages.threadId, tid))
    .orderBy(asc(mentorMessages.id));
  const history: ChatMessage[] = rows.map((r) => ({
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content,
  }));

  const [me] = await db
    .select({ name: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  // Rebuilt per message so the mentor always sees the student's real, current
  // course/lesson. Scoped to this session user; never persisted to the thread.
  const learning = await getMentorLearningContext(userId);

  const reply = await generateReply(history, {
    userName: me?.name?.split(" ")[0],
    learning,
  });

  await db.insert(mentorMessages).values({ threadId: tid, role: "assistant", content: reply });
  await db.update(mentorThreads).set({ updatedAt: new Date() }).where(eq(mentorThreads.id, tid));

  revalidatePath("/mentor");
  return { ok: true, threadId: tid, reply };
}
