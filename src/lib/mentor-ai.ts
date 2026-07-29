import "server-only";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Ephemeral snapshot of what the student is currently studying, injected into
 * the LLM system prompt so the mentor can answer in the context of their real
 * course/lesson. Built fresh per message (never persisted to chat history) and
 * always scoped to the authenticated user by the data layer.
 */
export interface MentorLearningContext {
  rank: string;
  level: number;
  currentStreak: number;
  activeCourse: { title: string; completed: number; total: number; percent: number } | null;
  currentLesson: {
    moduleTitle: string;
    title: string;
    description: string;
    position: number;
    total: number;
    completed: boolean;
    watchedPct: number;
  } | null;
  nextLesson: { title: string; moduleTitle: string } | null;
  otherCourses: string[];
}

interface MentorCtx {
  userName?: string;
  learning?: MentorLearningContext | null;
}

/**
 * AI mentor LLM seam. The whole app (chat UI, thread/message persistence) is
 * provider-agnostic; this file is the ONLY place that talks to an LLM.
 *
 * To go live, add ONE of these to .env.local (no code change needed):
 *
 *   GROQ_API_KEY=...        free, OpenAI-compatible (recommended to start)
 *   OPENAI_API_KEY=...      OpenAI (or any OpenAI-compatible gateway)
 *   ANTHROPIC_API_KEY=...   Claude
 *
 * Optional overrides: MENTOR_MODEL, and for OpenAI-compatible gateways
 * OPENAI_BASE_URL (defaults per provider).
 */

const SYSTEM_PROMPT =
  "Ты — AI-наставник образовательной платформы по искусственному интеллекту для " +
  "русскоязычных студентов из Казахстана. Помогай разбираться в темах курса: объясняй " +
  "понятно и по шагам, приводи короткие практические примеры, поддерживай и мотивируй. " +
  "Отвечай на русском языке, кратко и по делу. Обращайся к студенту на «вы». Не выдумывай " +
  "факты — если чего-то не знаешь, скажи об этом честно.";

const MAX_TURNS = 12; // trim long threads before sending to the model
const MAX_TOKENS = 800;

type Provider =
  | { kind: "anthropic"; apiKey: string; model: string }
  | { kind: "openai"; apiKey: string; model: string; baseUrl: string };

function resolveProvider(): Provider | null {
  const model = process.env.MENTOR_MODEL;
  if (process.env.GROQ_API_KEY) {
    return {
      kind: "openai",
      apiKey: process.env.GROQ_API_KEY,
      model: model || "llama-3.3-70b-versatile",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.groq.com/openai/v1",
    };
  }
  if (process.env.OPENAI_API_KEY || process.env.AI_API_KEY) {
    return {
      kind: "openai",
      apiKey: (process.env.OPENAI_API_KEY || process.env.AI_API_KEY)!,
      model: model || "gpt-4o-mini",
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      kind: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: model || "claude-sonnet-5",
    };
  }
  return null;
}

export function isMentorLive(): boolean {
  return resolveProvider() !== null;
}

export async function generateReply(
  history: ChatMessage[],
  ctx: MentorCtx = {},
): Promise<string> {
  const provider = resolveProvider();
  if (!provider) return demoReply(ctx);

  let system = SYSTEM_PROMPT;
  if (ctx.userName)
    system += `\nИмя студента: ${ctx.userName}. Обращайся по имени, когда уместно.`;
  if (ctx.learning) system += `\n\n${renderLearning(ctx.learning)}`;
  const turns = trimTurns(history);

  try {
    const reply =
      provider.kind === "anthropic"
        ? await callAnthropic(provider, system, turns)
        : await callOpenAICompatible(provider, system, turns);
    const text = reply.trim();
    return text || "Не удалось сформировать ответ. Попробуйте переформулировать вопрос.";
  } catch (err) {
    // The chat must never crash on a provider hiccup — degrade gracefully.
    console.error("[mentor-ai] provider call failed:", err);
    return "Извините, не получилось получить ответ прямо сейчас. Попробуйте ещё раз через минуту.";
  }
}

async function callOpenAICompatible(
  p: Extract<Provider, { kind: "openai" }>,
  system: string,
  turns: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...turns],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  p: Extract<Provider, { kind: "anthropic" }>,
  system: string,
  turns: ChatMessage[],
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: MAX_TOKENS,
      system,
      messages: turns,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

/**
 * Keeps the last MAX_TURNS messages, but never lets the window start on an
 * assistant turn: the Anthropic Messages API rejects an assistant-leading
 * `messages` array with a 400. History is strictly alternating and ends on the
 * user's new message, so trimming from the front always lands on a user turn.
 */
function trimTurns(history: ChatMessage[]): ChatMessage[] {
  const turns = history.slice(-MAX_TURNS);
  while (turns.length > 1 && turns[0].role !== "user") turns.shift();
  return turns;
}

/** Renders the learning context as a compact Russian block for the system prompt. */
function renderLearning(l: MentorLearningContext): string {
  const lines: string[] = ["[Контекст обучения студента]"];
  lines.push(
    `Ранг «${l.rank}» (уровень ${l.level})` +
      (l.currentStreak > 0 ? `, серия ${l.currentStreak} дн. подряд` : "") +
      ".",
  );
  if (l.activeCourse) {
    const c = l.activeCourse;
    lines.push(
      `Активный курс: «${c.title}» — пройдено ${c.completed} из ${c.total} уроков (${c.percent}%).`,
    );
  }
  if (l.currentLesson) {
    const cl = l.currentLesson;
    const status = cl.completed
      ? " (урок уже завершён — помоги закрепить или перейти дальше)"
      : cl.watchedPct > 0
        ? ` (просмотрено ~${cl.watchedPct}%)`
        : "";
    lines.push(
      `Сейчас изучает урок ${cl.position}/${cl.total}: «${cl.title}» (модуль «${cl.moduleTitle}»)${status}.`,
    );
    if (cl.description) lines.push(`О чём урок: ${cl.description}`);
  } else if (l.activeCourse && l.activeCourse.completed === 0) {
    // Only claim "hasn't started" when the course really has zero completions,
    // otherwise this would contradict the progress line above.
    lines.push("Студент ещё не открыл ни одного урока этого курса.");
  }
  if (l.nextLesson) {
    lines.push(`Следующий урок: «${l.nextLesson.title}» (модуль «${l.nextLesson.moduleTitle}»).`);
  }
  if (l.otherCourses.length > 0) {
    lines.push(`Другие курсы студента: ${l.otherCourses.join(", ")}.`);
  }
  if (!l.activeCourse && !l.currentLesson) {
    lines.push("Студент ещё не начал обучение — помоги выбрать курс и сделать первый шаг.");
  }
  lines.push(
    "По умолчанию считай, что вопросы относятся к текущему уроку и активному курсу. " +
      "Опирайся на этот контекст, но не выдумывай содержание уроков, которого здесь нет.",
  );
  return lines.join("\n");
}

/**
 * Reply used while no LLM provider is configured. The student must never see
 * env-var names or setup steps here — the actionable hint goes to the server
 * log only, and staff get the same hint in the banner on /mentor.
 */
function demoReply(ctx: MentorCtx): string {
  console.warn(
    "[mentor-ai] no LLM provider configured — students get the placeholder reply. " +
      "Set GROQ_API_KEY (free), OPENAI_API_KEY or ANTHROPIC_API_KEY to go live.",
  );
  const name = ctx.userName ? `, ${ctx.userName}` : "";
  const cl = ctx.learning?.currentLesson;
  const course = ctx.learning?.activeCourse;
  const contextLine = cl
    ? `Вижу, вы сейчас на уроке «${cl.title}»${course ? ` курса «${course.title}»` : ""} — ` +
      `с ним я обязательно помогу, как только вернусь.\n\n`
    : course
      ? `Вижу, вы проходите курс «${course.title}» — разберём его темы, как только я вернусь.\n\n`
      : "";
  return (
    `Здравствуйте${name}! Я ваш AI-наставник, но сейчас я временно недоступен — ` +
    `меня как раз настраивают.\n\n` +
    contextLine +
    `Пока лучше задать вопрос куратору: он ответит быстро и по существу. ` +
    `Ваше сообщение сохранится в чате — загляните сюда чуть позже, я скоро заработаю ` +
    `в полную силу.`
  );
}
