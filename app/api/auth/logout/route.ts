import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth";
import { USER_COOKIE } from "@/lib/session-client";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
  res.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
