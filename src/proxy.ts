import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, isStaff, SESSION_COOKIE } from "@/lib/session-token";

/**
 * Public storefront — reachable without an account. Everything else in the
 * matcher requires a session. Keep this list tight: each entry is a page a
 * stranger on the internet can read.
 */
const PUBLIC_EXACT = new Set(["/", "/courses", "/privacy"]);
const PUBLIC_PREFIXES = ["/courses/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  // Storefront: open to everyone, signed in or not.
  if (isPublic(pathname)) return NextResponse.next();

  // Public auth routes: send already-authenticated users to the app.
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/reset-password")
  ) {
    return session
      ? NextResponse.redirect(new URL("/dashboard", request.url))
      : NextResponse.next();
  }

  // Admin area: staff only.
  if (pathname.startsWith("/admin")) {
    if (!session) return NextResponse.redirect(new URL("/login", request.url));
    if (!isStaff(session.role)) {
      // Authenticated but not staff → back to the app (not the login page).
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Everything else that is matched requires authentication.
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes except API, Next internals, and static files (with a dot).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
