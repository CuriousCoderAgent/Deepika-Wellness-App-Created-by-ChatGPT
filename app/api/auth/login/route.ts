import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieName,
  sessionMaxAge,
  verifyCredentials,
} from "@/lib/auth";
import { verifyAccount } from "@/lib/accounts";
import { isConfigured } from "@/lib/db";
import { encodeUserCookie, USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { username, password, client } = await req.json().catch(() => ({}) as any);

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Missing credentials." }, { status: 400 });
  }

  // Accounts come from two places: the environment, which holds Deepika's
  // login and anything handed out by hand, and the database, which holds the
  // accounts members created for themselves. Environment first — it is the
  // one that works with no infrastructure at all.
  let user = await verifyCredentials(username, password);
  if (!user && isConfigured()) {
    try {
      user = await verifyAccount(username, password);
    } catch (err) {
      console.error("[login] account lookup failed", err);
    }
  }
  if (!user) {
    // One message for both wrong-user and wrong-password, so this can't be
    // used to discover which accounts exist.
    return NextResponse.json(
      { error: "That username and password don't match." },
      { status: 401 }
    );
  }

  if (client === "mobile" && user.role !== "member") {
    return NextResponse.json(
      { error: "The mobile app is for members. Please use the web coach console." },
      { status: 403 }
    );
  }

  const token = await createSessionToken(user);
  const res = NextResponse.json({
    role: user.role,
    user: { id: user.sub, name: user.name },
    ...(client === "mobile" ? { token } : {}),
  });
  res.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
  // Readable companion cookie — identity only, never a credential. See
  // lib/session-client.ts for why the two are separate.
  res.cookies.set(USER_COOKIE, encodeUserCookie(user), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return res;
}
