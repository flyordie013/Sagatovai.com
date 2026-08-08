import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BrandMark } from "@/components/layout/brand";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
// A sign-in form has nothing to offer a search result — keep it out of the
// index. robots.txt leaves the route open: it is reachable without a session,
// so it is not part of the "behind auth" block there.
export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/dashboard");
  const { reset } = await searchParams;

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold shadow-glow ring-inset-hair">
            <BrandMark className="size-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-[0.08em]">OQU</h1>
            <p className="mt-1 text-sm text-muted">Вход в личный кабинет</p>
          </div>
        </div>

        {reset === "1" && (
          <p className="mb-4 rounded-xl border border-teal/30 bg-teal/10 px-3 py-2.5 text-center text-sm text-teal">
            Пароль обновлён — войдите с новым паролем.
          </p>
        )}

        <LoginForm />

        <p className="mt-6 text-center text-sm text-muted">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-gold transition-colors hover:text-gold-soft"
          >
            Зарегистрироваться
          </Link>
        </p>

        {/* Dev-only helper — never rendered in a production build. */}
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-6 text-center text-xs leading-relaxed text-faint">
            Демо-доступ (только для разработки):{" "}
            <span className="font-mono text-muted">owner@oqu.academy</span> / студенты — см.
            README
          </p>
        )}
      </div>
    </div>
  );
}
