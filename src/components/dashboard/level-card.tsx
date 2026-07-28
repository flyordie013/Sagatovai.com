import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatNumber } from "@/lib/utils";
import { levelProgress } from "@/lib/leveling";
import type { UserSummary } from "@/types";

export function LevelCard({ user }: { user: UserSummary }) {
  const lp = levelProgress(user.xp);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <ProgressRing
          value={lp.percent}
          size={72}
          stroke={7}
          label={`Уровень ${lp.level}, прогресс ${lp.percent}%`}
        >
          <div className="text-center">
            <div className="font-display text-lg font-extrabold leading-none">
              {lp.level}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider text-faint">
              ур.
            </div>
          </div>
        </ProgressRing>
        <div className="min-w-0">
          <p className="font-display font-bold">
            Уровень {lp.level} → {lp.level + 1}
          </p>
          <p className="nums mt-0.5 text-sm text-muted">
            <span className="text-gold">{formatNumber(lp.xpIntoLevel)}</span> /{" "}
            {formatNumber(lp.xpSpan)} XP
          </p>
          <p className="mt-1 text-xs text-faint">
            ещё {formatNumber(lp.xpToNext)} XP до апа · {lp.rank}
          </p>
        </div>
      </div>
    </Card>
  );
}
