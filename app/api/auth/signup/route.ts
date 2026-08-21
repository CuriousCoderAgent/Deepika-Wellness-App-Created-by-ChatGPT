/**
 * Creating your own account.
 *
 * Deepika shares one link with her group and each woman signs herself up.
 * The alternative — Deepika minting twenty usernames and passwords by hand and
 * sending them out one by one — makes her the bottleneck and puts twenty
 * plaintext passwords into WhatsApp, which is worse on both counts.
 *
 * Two gates. Storage has to be configured, because an account has to live
 * somewhere the login route can read it and an environment variable is not
 * that. And a production SIGNUP_CODE has to match — a link shared in a group
 * chat travels further than the group, and that one variable is the difference
 * between "Deepika's cohort" and "anyone who has the URL". Leave it unset and
 * signup remains available without one only in local development.
 */

import { NextResponse } from "next/server";
import {
  authRateLimitKey,
  createAccount,
  emailProblem,
  normaliseUsername,
  passwordProblem,
  usernameProblem,
} from "@/lib/accounts";
import {
  createSessionToken,
  sessionSigningAvailable,
  sessionCookieName,
  sessionMaxAge,
} from "@/lib/auth";
import { consumeAuthRateLimit, isConfigured } from "@/lib/db";
import { encodeUserCookie, USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: Request) {
  if (!isConfigured() || !sessionSigningAvailable()) {
    return NextResponse.json(
      { error: "Accounts aren't set up on this deployment yet." },
      { status: 503 },
    );
  }

  const required = process.env.SIGNUP_CODE?.trim();
  if (process.env.NODE_ENV === "production" && !required) {
    return NextResponse.json(
      { error: "Account invitations aren't configured yet." },
      { status: 503 },
    );
  }

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
  const raw = await req.text();
  if (raw.length > 8_192) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const body = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();
  const rawUsername = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const code = typeof body.code === "string" ? body.code : "";
  const client = typeof body.client === "string" ? body.client : "";

  try {
    const allowed = await consumeAuthRateLimit({
      scope: "signup-address",
      keyHash: authRateLimitKey("signup-address", clientAddress(req)),
      limit: 5,
      windowSeconds: 60 * 60,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many account attempts. Try again later." },
        { status: 429 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Account creation is temporarily unavailable." },
      { status: 503 },
    );
  }

  if (required && code.trim() !== required) {
    return NextResponse.json(
      { error: "That join code isn't right." },
      { status: 403 },
    );
  }

  if (!name.trim()) {
    return NextResponse.json(
      { error: "Please add your name." },
      { status: 400 },
    );
  }

  const badEmail = emailProblem(email);
  if (badEmail) return NextResponse.json({ error: badEmail }, { status: 400 });

  const username = normaliseUsername(rawUsername);
  const badUsername = usernameProblem(username);
  if (badUsername)
    return NextResponse.json({ error: badUsername }, { status: 400 });

  const badPassword = passwordProblem(password);
  if (badPassword)
    return NextResponse.json({ error: badPassword }, { status: 400 });

  let user;
  try {
    user = await createAccount(username, password, name, email);
  } catch (err) {
    console.error("[signup] failed", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "An account couldn't be created with those details." },
      { status: 409 },
    );
  }

  // Signed up means signed in. Making someone type the password they chose
  // four seconds ago proves nothing.
  const token = await createSessionToken(user);
  const res = NextResponse.json({
    role: user.role,
    user: { id: user.sub, name: user.name },
    ...(client === "mobile" ? { token } : {}),
  });
  const cookie = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  };
  res.cookies.set(sessionCookieName, token, {
    ...cookie,
    httpOnly: true,
  });
  res.cookies.set(USER_COOKIE, encodeUserCookie(user), {
    ...cookie,
    httpOnly: false,
  });
  return res;
}
