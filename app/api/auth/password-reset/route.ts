import { NextResponse } from "next/server";
import {
  authRateLimitKey,
  passwordProblem,
  resetPassword,
} from "@/lib/accounts";
import { sessionCookieName } from "@/lib/auth";
import { consumeAuthRateLimit, isConfigured } from "@/lib/db";
import { USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function invalidLink() {
  return NextResponse.json(
    { error: "This reset link is invalid or has expired. Request a new one." },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    return NextResponse.json(
      { error: "Unsupported request." },
      { status: 415 },
    );
  }
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(contentLength) || contentLength > 8_192)
    return invalidLink();

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const badPassword = passwordProblem(password);
  if (badPassword)
    return NextResponse.json({ error: badPassword }, { status: 400 });
  if (!token || !isConfigured()) return invalidLink();

  try {
    const addressAllowed = await consumeAuthRateLimit({
      scope: "password-reset-address",
      keyHash: authRateLimitKey("password-reset-address", clientAddress(req)),
      limit: 10,
      windowSeconds: 15 * 60,
    });
    if (!addressAllowed) return invalidLink();
    const tokenAllowed = await consumeAuthRateLimit({
      scope: "password-reset-token",
      keyHash: authRateLimitKey("password-reset-token", token),
      limit: 5,
      windowSeconds: 15 * 60,
    });
    if (!tokenAllowed) return invalidLink();

    if (!(await resetPassword(token, password))) return invalidLink();

    const response = NextResponse.json({
      message: "Your password has been changed. Sign in with the new password.",
    });
    // Clear this browser immediately. Other database-backed sessions carry an
    // older sessionVersion and fail Node-side session validation.
    response.cookies.set(sessionCookieName, "", { path: "/", maxAge: 0 });
    response.cookies.set(USER_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json(
      { error: "We couldn’t reset the password right now. Please try again." },
      { status: 503 },
    );
  }
}
