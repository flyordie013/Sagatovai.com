import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

// GET /logout — clears the session cookie and returns to the login page.
// A route handler can mutate cookies (a Server Component render cannot), which
// is what breaks the "valid cookie but no profile" redirect loop.
export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
