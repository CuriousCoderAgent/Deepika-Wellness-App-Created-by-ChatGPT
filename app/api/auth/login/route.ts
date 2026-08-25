import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionSigningAvailable,
  sessionCookieName,
  sessionMaxAge,
  verifyCredentials,
} from "@/lib/auth";
import { rateLimitKey, verifyAccount } from "@/lib/accounts";
import { consumeRateLimit, isConfigured } from "@/lib/db";
import { encodeUserCookie, USER_COOKIE } from "@/lib/session-client";

export const runtime = "nodejs";

function clientAddress(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(req: Request) {
  if (
    !sessionSigningAvailable() ||
    (process.env.NODE_ENV === "production" && !isConfigured())
  ) {
    return NextResponse.json(
      { error: "Sign-in is not configured on this deployment." },
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
  const { username, password, client } = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {} as Record<string, unknown>;
    }
  })();

  if (typeof username !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Missing credentials." },
      { status: 400 },
    );
  }

  if (isConfigured()) {
    try {
      const addressAllowed = await consumeRateLimit({
        scope: "login-address",
        keyHash: rateLimitKey("login-address", clientAddress(req)),
        limit: 20,
        windowSeconds: 15 * 60,
      });
      if (!addressAllowed) {
        return NextResponse.json(
          { error: "Too many sign-in attempts. Try again later." },
          { status: 429 },
        );
      }
      const accountAllowed = await consumeRateLimit({
        scope: "login-account",
        keyHash: rateLimitKey("login-account", username.slice(0, 254)),
        limit: 10,
        windowSeconds: 15 * 60,
      });
      if (!accountAllowed) {
        return NextResponse.json(
          { error: "Too many sign-in attempts. Try again later." },
          { status: 429 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Sign-in is temporarily unavailable." },
        { status: 503 },
      );
    }
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
      { status: 401 },
    );
  }

  if (client === "mobile" && user.role !== "member") {
    return NextResponse.json(
      {
        error:
          "The mobile app is for members. Please use the web coach console.",
      },
      { status: 403 },
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
