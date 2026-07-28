import {
  Gift,
  Shirt,
  BookOpen,
  Video,
  Sticker,
  Coffee,
  Award,
  Ticket,
  Sparkles,
  Zap,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { requireUser } from "@/lib/session";
import { getStore, type StoreItem } from "@/data/store";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn, formatNumber } from "@/lib/utils";
import { ClaimButton } from "./claim-button";

export const metadata = { title: "Магазин" };

/** lucide icon by the item's `icon` string, with a category-based fallback. */
const ICON_MAP: Record<string, LucideIcon> = {
  gift: Gift,
  shirt: Shirt,
  merch: Shirt,
  book: BookOpen,
  guide: BookOpen,
  video: Video,
  sticker: Sticker,
  coffee: Coffee,
  award: Award,
  ticket: Ticket,
  sparkles: Sparkles,
  zap: Zap,
};

const CATEGORY_FALLBACK: Record<string, LucideIcon> = {
  merch: Shirt,
  guide: BookOpen,
  video: Video,
};

const CATEGORY_LABEL: Record<string, string> = {
  merch: "Мерч",
  guide: "Гайды и материалы",
  video: "Видео и записи",
};

const CATEGORY_ORDER = ["merch", "guide", "video"];

function iconFor(item: StoreItem): LucideIcon {
  return ICON_MAP[item.icon] ?? CATEGORY_FALLBACK[item.category] ?? Gift;
}

function RewardCard({ item, xp }: { item: StoreItem; xp: number }) {
  const Icon = iconFor(item);
  const locked = !item.unlocked;
  const xpShort = Math.max(0, item.xpRequired - xp);
  const pct =
    item.xpRequired > 0 ? Math.round((xp / item.xpRequired) * 100) : 100;

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-5 shadow-card ring-inset-hair transition duration-300 ease-[var(--ease-soft)]",
        locked ? "opacity-70" : "hover:-translate-y-0.5 hover:border-line-strong",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={cn(
            "grid size-12 place-items-center rounded-xl border",
            locked
              ? "border-line-strong bg-white/5 text-muted"
              : "border-gold/25 bg-gold/10 text-gold",
          )}
        >
          <Icon className="size-6" strokeWidth={1.8} />
        </div>
        {item.claimed ? (
          <Badge variant="teal">Получено</Badge>
        ) : locked ? (
          <Badge variant="neutral">
            <Lock className="size-3" />
            {formatNumber(item.xpRequired)} XP
          </Badge>
        ) : (
          <Badge variant="gold">Доступно</Badge>
        )}
      </div>

      <h3 className="font-display text-lg font-bold leading-snug">{item.name}</h3>
      {item.description && (
        <p className="mt-1.5 text-sm text-muted">{item.description}</p>
      )}

      <div className="mt-4 flex items-center gap-1.5 font-mono text-xs text-gold">
        <Zap className="size-3.5 fill-gold" />
        <span className="nums text-text">{formatNumber(item.xpRequired)}</span>
        <span className="text-muted">XP для разблокировки</span>
      </div>

      {locked && (
        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
            <span className="text-muted">
              {formatNumber(Math.min(xp, item.xpRequired))} /{" "}
              {formatNumber(item.xpRequired)}
            </span>
            <span className="nums font-medium text-text">{pct}%</span>
          </div>
          <ProgressBar
            value={pct}
            aria-label={`Прогресс до награды ${item.name}`}
          />
        </div>
      )}

      <div className="mt-5">
        <ClaimButton
          itemId={item.id}
          category={item.category}
          claimed={item.claimed}
          unlocked={item.unlocked}
          xpShort={xpShort}
          payloadUrl={item.payloadUrl}
        />
      </div>
    </article>
  );
}

export default async function StorePage() {
  const { userId } = await requireUser();
  const { xp, items } = await getStore(userId);

  const unlockedCount = items.filter((i) => i.unlocked).length;
  const claimedCount = items.filter((i) => i.claimed).length;

  // Group by category, known categories first (in order), then any others.
  const byCategory = new Map<string, StoreItem[]>();
  for (const it of items) {
    const list = byCategory.get(it.category) ?? [];
    list.push(it);
    byCategory.set(it.category, list);
  }
  const categories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="mx-auto max-w-[1480px] space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          Магазин
        </h1>
        <p className="text-muted">
          Разблокируй награды за накопленный XP
        </p>
      </header>

      <Card className="overflow-hidden bg-gradient-to-br from-raised to-surface p-6 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold shadow-glow">
              <Zap className="size-7 fill-gold/40" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-wider text-faint">
                Твой баланс
              </p>
              <p className="nums font-display text-3xl font-extrabold leading-none sm:text-4xl">
                {formatNumber(xp)}{" "}
                <span className="text-xl text-gold sm:text-2xl">XP</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-center ring-inset-hair">
              <div className="nums font-display text-2xl font-extrabold leading-none text-gold">
                {unlockedCount}
              </div>
              <div className="mt-1 text-xs text-muted">Доступно</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-center ring-inset-hair">
              <div className="nums font-display text-2xl font-extrabold leading-none text-teal">
                {claimedCount}
              </div>
              <div className="mt-1 text-xs text-muted">Получено</div>
            </div>
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border border-line-strong bg-white/5 text-muted">
            <Gift className="size-7" strokeWidth={1.6} />
          </div>
          <p className="font-display text-lg font-bold">Наград пока нет</p>
          <p className="mt-1.5 text-sm text-muted">
            Скоро здесь появятся награды за твой прогресс. Продолжай учиться и
            копи XP.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            return (
              <section key={cat} className="space-y-4">
                <h2 className="font-display text-lg font-bold text-muted">
                  {CATEGORY_LABEL[cat] ?? cat}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((item) => (
                    <RewardCard key={item.id} item={item} xp={xp} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
