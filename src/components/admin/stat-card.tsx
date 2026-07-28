import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="grid size-10 place-items-center rounded-xl border border-gold/20 bg-gold/10 text-gold">
          <Icon className="size-5" strokeWidth={1.9} />
        </div>
        {sub ? <span className="font-mono text-[11px] text-muted">{sub}</span> : null}
      </div>
      <div className="nums mt-3 font-display text-2xl font-extrabold leading-none">
        {value}
      </div>
      <div className="mt-1.5 text-sm text-muted">{label}</div>
    </Card>
  );
}
