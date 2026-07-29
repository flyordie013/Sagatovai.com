import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  /** Makes the whole tile a link to the screen that acts on this number. */
  href?: string;
}) {
  const card = (
    <Card className={cn("p-5", href && "h-full transition-colors hover:border-line-strong")}>
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

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
