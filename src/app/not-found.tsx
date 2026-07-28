import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";

export const metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold shadow-glow ring-inset-hair">
          <BrandMark className="size-7" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">404</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          Такой страницы нет
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Возможно, ссылка устарела или страницу перенесли.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-semibold text-gold-ink shadow-glow transition-colors hover:bg-gold-soft"
          >
            В кабинет
            <ArrowRight className="size-4" />
          </Link>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-raised px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-raised-2"
          >
            <Compass className="size-4" />
            Все курсы
          </Link>
        </div>
      </div>
    </div>
  );
}
