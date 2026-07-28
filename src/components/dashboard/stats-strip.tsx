import { TrendingUp, GraduationCap, Trophy, type LucideIcon } from "lucide-react";

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 ring-inset-hair">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
        <Icon className="size-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="nums font-display text-xl font-extrabold leading-none">
          {value}
        </div>
        <div className="mt-1 text-xs leading-tight text-muted">{label}</div>
      </div>
    </div>
  );
}

export function StatsStrip({
  progressPct,
  completed,
  total,
  achievements,
}: {
  progressPct: number;
  completed: number;
  total: number;
  achievements: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tile icon={TrendingUp} label="Прогресс курса" value={`${progressPct}%`} />
      <Tile
        icon={GraduationCap}
        label="Уроки курсов"
        value={`${completed}/${total}`}
      />
      <Tile icon={Trophy} label="Достижения" value={String(achievements)} />
    </div>
  );
}
