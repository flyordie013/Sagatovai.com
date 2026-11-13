import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { getSession } from "@/lib/session";
import { isLegalConfigured, isRefundConfigured } from "@/lib/legal";

// Reads the session (cookies) and live course data — render on demand.
export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main-content" className="skip-link btn-primary">Перейти к содержанию</a>
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold ring-inset-hair">
              <BrandMark className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-[0.08em]">OQU</span>
          </Link>

          <nav aria-label="Основная навигация" className="ml-auto flex items-center gap-2">
            <Link href="/#format" className="hidden px-3 py-2 text-sm text-muted hover:text-text md:block">Как учиться</Link>
            <Link href="/#questions" className="hidden px-3 py-2 text-sm text-muted hover:text-text md:block">Вопросы</Link>
            <Link
              href="/courses"
              className="rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:text-text sm:px-3"
            >
              Курсы
            </Link>
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-ink transition-colors hover:bg-gold-soft"
              >
                В кабинет
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:text-text"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="hidden rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold text-text transition-colors hover:bg-raised sm:block"
                >
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:px-6">
          <p>© {new Date().getFullYear()} OQU — практическое обучение AI</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto">
            <Link href="/courses" className="transition-colors hover:text-muted">
              Все курсы
            </Link>
            <Link href="/contacts" className="transition-colors hover:text-muted">
              Контакты
            </Link>
            {/* Legal pages exist only once the owner has filled LEGAL_* in —
                linking to a 404 is worse than not linking at all. */}
            {isLegalConfigured && (
              <Link href="/offer" className="transition-colors hover:text-muted">
                Оферта
              </Link>
            )}
            {isRefundConfigured && (
              <Link href="/refund" className="transition-colors hover:text-muted">
                Возврат
              </Link>
            )}
            <Link href="/privacy" className="transition-colors hover:text-muted">
              Конфиденциальность
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
