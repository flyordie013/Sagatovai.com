import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { BrandMark } from "@/components/layout/brand";
import { ForgotForm } from "./forgot-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Восстановление пароля" };

export default async function ForgotPasswordPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="grid size-14 place-items-center rounded-2xl border border-gold/40 bg-gradient-to-br from-[#2a2418] to-raised text-gold shadow-glow ring-inset-hair"
          >
            <BrandMark className="size-7" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-[0.08em]">OQU</h1>
            <p className="mt-1 text-sm text-muted">Восстановление доступа</p>
          </div>
        </div>

        <ForgotForm />

        <p className="mt-6 text-center text-sm text-muted">
          Вспомнили пароль?{" "}
          <Link href="/login" className="font-semibold text-gold transition-colors hover:text-gold-soft">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
