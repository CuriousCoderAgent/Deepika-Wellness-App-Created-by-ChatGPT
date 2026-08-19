import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, sessionCookieName } from "@/lib/auth";

/**
 * Route protection, enforced on the server.
 *
 * A client-side redirect is decoration — anyone can skip it. This runs
 * before the page does, so an unauthenticated request never reaches a
 * screen holding someone's health data.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSessionToken(req.cookies.get(sessionCookieName)?.value);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // The coach can open a member's app — that's the "See her app" flow, and
  // she needs it. A member can never reach the console.
  if (pathname.startsWith("/coach") && session.role !== "coach") {
    return NextResponse.redirect(new URL("/member", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/member/:path*", "/coach/:path*", "/onboarding"],
};
