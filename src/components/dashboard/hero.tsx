import { Ornament } from "./ornament";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Ornament className="pointer-events-none absolute -right-8 -top-12 hidden h-48 w-48 text-gold/10 sm:block" />
      <p className="mb-3 inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.32em] text-gold">
        <span className="h-px w-6 bg-gradient-to-r from-gold to-transparent" />
        Каталог
      </p>
      <h2 className="max-w-[16ch] text-balance font-display text-3xl font-extrabold leading-[1.03] tracking-tight sm:text-4xl md:text-[42px]">
        Выберите свой курс
      </h2>
      <p className="mt-3 max-w-[48ch] text-[15px] text-muted">
        Изучайте AI и собирайте реальные проекты — от первого промпта до продукта,
        который приносит деньги.
      </p>
    </section>
  );
}
