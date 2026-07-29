import { Trophy, Flame, GraduationCap, Medal } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getLeaderboardWithSelf, type LeaderboardRow } from "@/data/leaderboard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatNumber, pluralize } from "@/lib/utils";

export const metadata = { title: "Рейтинг" };

/** Инициалы из полного имени: «Данияр Ахметов» → «ДА». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "?";
}

/** Цвет медали для мест 1–3. */
const MEDAL: Record<number, string> = {
  1: "text-gold",
  2: "text-[#c3ccd6]",
  3: "text-[#cd8a4e]",
};

const PODIUM_ORDER = [2, 1, 3]; // визуальный порядок: серебро — золото — бронза

function Avatar({
  name,
  className,
  highlight,
}: {
  name: string;
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-display font-bold",
        highlight
          ? "border-gold/40 bg-gold/10 text-gold"
          : "border-line-strong bg-raised-2 text-muted",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

function PodiumCard({ row, place }: { row: LeaderboardRow; place: number }) {
  const isFirst = place === 1;
  return (
    <Card
      className={cn(
        "flex flex-col items-center gap-3 p-5 text-center",
        isFirst && "border-gold/40 shadow-glow sm:-translate-y-3",
        row.isCurrentUser && !isFirst && "border-gold/40",
      )}
    >
      <div className={cn("font-display text-3xl font-extrabold", MEDAL[place])}>
        {place}
      </div>
      <Avatar
        name={row.name}
        highlight={isFirst}
        className={cn(isFirst ? "size-16 text-xl" : "size-14 text-lg")}
      />
      <div className="min-w-0">
        <p className="truncate font-display font-bold">{row.name}</p>
        <p className="mt-0.5 text-xs text-faint">{row.rank}</p>
      </div>
      <div className="nums font-mono text-lg font-bold text-gold">
        {formatNumber(row.xp)} XP
      </div>
      <div className="flex items-center gap-3 font-mono text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <Flame className="size-3.5 text-gold" />
          <span className="nums">{row.streak}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <GraduationCap className="size-3.5" />
          <span className="nums">{row.completed}</span>
        </span>
      </div>
    </Card>
  );
}

function Row({ row, place }: { row: LeaderboardRow; place: number }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-surface p-3 ring-inset-hair transition-colors sm:gap-4 sm:p-4",
        row.isCurrentUser
          ? "border-gold/40 bg-gold/[0.04]"
          : "border-line hover:border-line-strong",
      )}
    >
      <div
        className={cn(
          "w-7 shrink-0 text-center font-mono text-sm font-bold sm:w-9 sm:text-base",
          MEDAL[place] ?? "text-faint",
        )}
      >
        {place <= 3 ? (
          <>
            <Medal className={cn("mx-auto size-5", MEDAL[place])} aria-hidden />
            {/* Place is otherwise conveyed by medal colour alone. */}
            <span className="sr-only">{place} место</span>
          </>
        ) : (
          place
        )}
      </div>

      <Avatar
        name={row.name}
        highlight={row.isCurrentUser}
        className="size-10 text-sm sm:size-11"
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-display font-bold">
          <span className="truncate">{row.name}</span>
          {row.isCurrentUser && <Badge variant="gold">Вы</Badge>}
        </p>
        <p className="mt-0.5 text-xs text-faint">
          {row.rank} · ур. {row.level}
        </p>
      </div>

      {/* Пройдено уроков — скрыто на мобиле */}
      <div className="hidden w-24 shrink-0 flex-col items-end sm:flex">
        <span className="nums font-mono text-sm font-medium text-text">
          {formatNumber(row.completed)}
        </span>
        <span className="text-[11px] text-faint">
          {pluralize(row.completed, ["урок", "урока", "уроков"])}
        </span>
      </div>

      {/* Стрик — скрыт на самых узких экранах */}
      <div className="hidden w-16 shrink-0 flex-col items-end sm:flex">
        <span className="nums inline-flex items-center gap-1 font-mono text-sm font-medium text-text">
          <Flame className="size-3.5 text-gold" />
          {row.streak}
        </span>
        <span className="text-[11px] text-faint">стрик</span>
      </div>

      <div className="flex w-20 shrink-0 flex-col items-end sm:w-24">
        <span className="nums font-mono text-base font-bold text-gold">
          {formatNumber(row.xp)}
        </span>
        <span className="text-[11px] uppercase tracking-wider text-faint">
          XP
        </span>
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const { userId } = await requireUser();
  const { top: rows, self, totalStudents } = await getLeaderboardWithSelf(userId);

  const podium = rows.slice(0, 3);
  const hasPodium = podium.length === 3;

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Рейтинг
          </h1>
          <p className="mt-1 text-sm text-muted">Топ учеников OQU</p>
        </div>
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">
          <Trophy className="size-6" strokeWidth={1.8} />
        </div>
      </header>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-muted">Рейтинг пока пуст — начните проходить уроки.</p>
        </Card>
      ) : (
        <>
          {hasPodium && (
            <div className="grid grid-cols-3 items-end gap-3 sm:gap-4">
              {PODIUM_ORDER.map((place) => (
                <PodiumCard
                  key={podium[place - 1].id}
                  row={podium[place - 1]}
                  place={place}
                />
              ))}
            </div>
          )}

          <div className="space-y-2">
            {rows.map((row, i) => (
              <Row key={row.id} row={row} place={i + 1} />
            ))}
          </div>

          {/* Outside the top list → still show the student where they stand,
              otherwise the board is one they can never see themselves on. */}
          {self && (
            <div className="space-y-2 border-t border-line pt-4">
              <p className="text-xs text-muted">
                Ваша позиция — {self.position} место из {totalStudents}
              </p>
              <Row row={self} place={self.position} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
