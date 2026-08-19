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
 * that. And if SIGNUP_CODE is set, it has to match — a link shared in a group
 * chat travels further than the group, and that one variable is the difference
 * between "Deepika's cohort" and "anyone who has the URL". Leave it unset and
 * signup is open, which is the right default for a pilot that is still being
 * handed out person to person.
 */

import { NextResponse } from "next/server";
import {
  createAccount,
  normaliseUsername,
  passwordProblem,
  usernameProblem,
} from "@/lib/accounts";
import { createSessionToken, sessionCookieName, sessionMaxAge } from "@/lib/auth";
import { isConfigured } from "@/lib/db";
import { encodeUserCookie, USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Accounts aren't set up on this deployment yet." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const rawUsername = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";
  const code = typeof body.code === "string" ? body.code : "";

  const required = process.env.SIGNUP_CODE?.trim();
  if (required && code.trim() !== required) {
    return NextResponse.json({ error: "That join code isn't right." }, { status: 403 });
  }

  if (!name.trim()) {
    return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  }

  const username = normaliseUsername(rawUsername);
  const badUsername = usernameProblem(username);
  if (badUsername) return NextResponse.json({ error: badUsername }, { status: 400 });

  const badPassword = passwordProblem(password);
  if (badPassword) return NextResponse.json({ error: badPassword }, { status: 400 });

  let user;
  try {
    user = await createAccount(username, password, name);
  } catch (err) {
    console.error("[signup] failed", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json(
      { error: "That username is taken. Try another one." },
      { status: 409 }
    );
  }

  // Signed up means signed in. Making someone type the password they chose
  // four seconds ago proves nothing.
  const res = NextResponse.json({ role: user.role });
  const cookie = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  };
  res.cookies.set(sessionCookieName, await createSessionToken(user), {
    ...cookie,
    httpOnly: true,
  });
  res.cookies.set(USER_COOKIE, encodeUserCookie(user), { ...cookie, httpOnly: false });
  return res;
}
