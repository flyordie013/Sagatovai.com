import {
  Trophy,
  CheckCircle2,
  Lock,
  Flame,
  Star,
  Rocket,
  Target,
  Award,
  Medal,
  Crown,
  Zap,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProgressRing } from "@/components/ui/progress-ring";
import { getAchievements, type AchievementItem } from "@/data/achievements";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata = { title: "Достижения" };

/** Pick a themed icon from the achievement code (best-effort, with fallback). */
function iconFor(code: string): LucideIcon {
  const c = code.toLowerCase();
  if (c.includes("streak") || c.includes("flame") || c.includes("fire"))
    return Flame;
  if (c.includes("first") || c.includes("start") || c.includes("begin"))
    return Rocket;
  if (c.includes("lesson") || c.includes("course") || c.includes("learn"))
    return GraduationCap;
  if (c.includes("star")) return Star;
  if (c.includes("target") || c.includes("goal") || c.includes("mission"))
    return Target;
  if (c.includes("speed") || c.includes("fast") || c.includes("zap"))
    return Zap;
  if (c.includes("master") || c.includes("crown") || c.includes("legend"))
    return Crown;
  if (c.includes("medal") || c.includes("silver") || c.includes("bronze"))
    return Medal;
  if (c.includes("award") || c.includes("gold")) return Award;
  return Trophy;
}

function AchievementCard({
  item,
  icon: Icon,
}: {
  item: AchievementItem;
  icon: LucideIcon;
}) {

  return (
    <Card
      className={cn(
        "flex flex-col p-5 transition-colors",
        item.unlocked
          ? "border-teal/30 bg-teal/5"
          : "opacity-90 hover:border-line-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl border",
            item.unlocked
              ? "border-teal/30 bg-teal/10 text-teal"
              : "border-line-strong bg-raised text-faint",
          )}
        >
          <Icon className="size-6" strokeWidth={1.8} />
        </div>

        {item.unlocked ? (
          <Badge variant="teal">
            <CheckCircle2 className="size-3.5" strokeWidth={2.2} />
            Получено
          </Badge>
        ) : (
          <Badge variant="neutral">
            <Lock className="size-3.5" strokeWidth={2.2} />
            Закрыто
          </Badge>
        )}
      </div>

      <h3
        className={cn(
          "mt-4 font-display text-lg font-bold leading-tight",
          !item.unlocked && "text-muted",
        )}
      >
        {item.title}
      </h3>
      {item.description ? (
        <p className="mt-1.5 text-sm leading-snug text-faint">
          {item.description}
        </p>
      ) : null}

      <div className="mt-auto pt-4">
        {item.unlocked ? (
          <div className="nums flex items-center gap-1.5 font-mono text-sm font-semibold text-teal">
            <Zap className="size-4" strokeWidth={2} />+{item.xpReward} XP
          </div>
        ) : (
          <div className="space-y-1.5">
            <ProgressBar
              value={(item.progress / item.target) * 100}
              aria-label={`Прогресс достижения ${item.title}`}
            />
            <div className="nums flex items-center justify-between font-mono text-xs text-faint">
              <span>
                {item.progress}/{item.target}
              </span>
              <span className="text-gold">+{item.xpReward} XP</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default async function AchievementsPage() {
  const { userId } = await requireUser();
  const { items, unlockedCount, total } = await getAchievements(userId);
  const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ProgressRing
            value={pct}
            size={72}
            stroke={7}
            label={`Получено ${unlockedCount} из ${total} достижений`}
          >
            <div className="text-center">
              <div className="nums font-display text-lg font-extrabold leading-none">
                {unlockedCount}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-faint">
                из {total}
              </div>
            </div>
          </ProgressRing>
          <div>
            <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
              Достижения
            </h1>
            <p className="nums mt-1 text-sm text-muted">
              <span className="text-gold">{unlockedCount}</span> из {total}{" "}
              получено
            </p>
          </div>
        </div>
      </header>

      {total === 0 ? (
        <Card className="grid place-items-center gap-3 px-6 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-gold/20 bg-gold/10 text-gold">
            <Trophy className="size-7" strokeWidth={1.7} />
          </div>
          <p className="font-display text-lg font-bold">Достижений пока нет</p>
          <p className="max-w-sm text-sm text-muted">
            Проходите уроки — здесь появятся бейджи и награды за ваш прогресс.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <AchievementCard
              key={item.code}
              item={item}
              icon={iconFor(item.code)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
