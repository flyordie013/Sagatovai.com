import { CheckCircle2, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Mission } from "@/types";

export function MissionCard({ mission }: { mission: Mission | null }) {
  // No active unfinished mission → say so honestly. Previously the dashboard
  // synthesized a placeholder that no code path could advance, so the card
  // promised XP the platform would never pay.
  if (!mission) {
    return (
      <Card className="p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          Текущая цель
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-line-strong bg-white/5 text-muted">
            <Target className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Все цели выполнены</p>
            <p className="text-sm text-muted">
              Новые появятся позже — просто продолжайте учиться.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const pct = mission.target > 0 ? (mission.current / mission.target) * 100 : 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
          Текущая цель
        </p>
        <span className="font-mono text-xs font-semibold text-gold">
          +{mission.xpReward} XP
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-teal/30 bg-teal/10 text-teal">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{mission.title}</p>
          <p className="truncate text-sm text-muted">{mission.description}</p>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={pct} aria-label="Прогресс цели" />
        <p className="nums mt-1.5 text-right text-xs text-faint">
          {mission.current} / {mission.target}
        </p>
      </div>
    </Card>
  );
}
