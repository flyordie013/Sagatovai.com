import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { BrandMark } from "@/components/layout/brand";
import { getSession } from "@/lib/session";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contacts";
import { isLegalConfigured, isRefundConfigured } from "@/lib/legal";

// Reads the session (cookies) and live course data — render on demand.
export const dynamic = "force-dynamic";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1120px] items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold ring-inset-hair">
              <BrandMark className="size-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-[0.08em]">OQU</span>
          </Link>

          <nav className="ml-auto flex items-center gap-2">
            <Link
              href="/courses"
              className="hidden rounded-xl px-3 py-2 text-sm text-muted transition-colors hover:text-text sm:block"
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
                  className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-gold-ink transition-colors hover:bg-gold-soft"
                >
                  Начать бесплатно
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:px-6">
          <p>© {new Date().getFullYear()} OQU — обучение с AI-наставником</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto">
            {/* The only direct contact on the public site — a visitor who does
                not want to wait for a callback needs somewhere to write. */}
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-muted"
            >
              <MessageCircle className="size-4 shrink-0" />
              <span className="nums">{SUPPORT_PHONE_DISPLAY}</span>
            </a>
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
