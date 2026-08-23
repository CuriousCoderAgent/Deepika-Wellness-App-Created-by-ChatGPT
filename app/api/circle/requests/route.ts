/**
 * Asking to join someone's circle, and answering when someone asks.
 *
 * POST sends a request. PATCH accepts, declines or blocks one. DELETE removes
 * an existing connection or withdraws a request that has not been answered.
 *
 * Nothing here reveals whether a username exists. A request to an unknown
 * member and a request to a real member who has not opted in return the same
 * response, because the alternative turns this route into a way to enumerate
 * the pilot cohort.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { authRateLimitKey } from "@/lib/accounts";
import {
  consumeAuthRateLimit,
  createConnectionRequest,
  isConfigured,
  readCircleProfile,
  removeConnection,
  respondToConnection,
} from "@/lib/db";
import { normaliseUsername } from "@/lib/accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One answer for every outcome that is not an unambiguous success. */
const SENT = {
  message: "If that member is on Bharosa Wellness, your request is on its way.",
};

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

async function memberSession() {
  const user = await session();
  if (!user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (user.role !== "member")
    return {
      error: NextResponse.json(
        { error: "The circle is a member feature." },
        { status: 403 },
      ),
    };
  if (!isConfigured())
    return {
      error: NextResponse.json(
        { error: "Storage is not configured." },
        { status: 503 },
      ),
    };
  return { user };
}

async function readBody(req: Request) {
  const raw = await req.text();
  if (raw.length > 8_192) return null;
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { user, error } = await memberSession();
  if (error) return error;
  const body = await readBody(req);
  if (!body)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const target = normaliseUsername(String(body.memberId ?? ""));
  if (!target)
    return NextResponse.json(
      { error: "Enter the member you want to add." },
      { status: 400 },
    );
  if (target === user!.sub)
    return NextResponse.json(
      { error: "That is you." },
      { status: 400 },
    );

  try {
    // Without this, the anti-enumeration response above is worthless: someone
    // could simply try every plausible username and read the timing.
    const allowed = await consumeAuthRateLimit({
      scope: "circle-request",
      keyHash: authRateLimitKey("circle-request", user!.sub),
      limit: 20,
      windowSeconds: 60 * 60,
    });
    if (!allowed)
      return NextResponse.json(
        { error: "That is a lot of requests. Try again a bit later." },
        { status: 429 },
      );

    // Only members who chose to be reachable can be added. A member who has
    // never opened the circle screen is not silently in it.
    const theirProfile = await readCircleProfile(target);
    if (!theirProfile.discoverable && !theirProfile.shareActivity)
      return NextResponse.json(SENT);

    await createConnectionRequest(user!.sub, target);
    // Deliberately the same response whether or not a row was created, so a
    // repeat request cannot confirm that a previous one was declined.
    return NextResponse.json(SENT);
  } catch (err) {
    console.error("[circle] request failed", err);
    return NextResponse.json(
      { error: "Your request could not be sent." },
      { status: 503 },
    );
  }
}

export async function PATCH(req: Request) {
  const { user, error } = await memberSession();
  if (error) return error;
  const body = await readBody(req);
  if (!body)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const requesterId = normaliseUsername(String(body.memberId ?? ""));
  const decision = String(body.decision ?? "");
  if (!requesterId || !["accepted", "declined", "blocked"].includes(decision))
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    // The query only matches rows where this member is the addressee, so a
    // member cannot accept a request on someone else's behalf.
    const updated = await respondToConnection(
      user!.sub,
      requesterId,
      decision as "accepted" | "declined" | "blocked",
    );
    if (!updated)
      return NextResponse.json(
        { error: "That request is no longer waiting." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, decision });
  } catch (err) {
    console.error("[circle] response failed", err);
    return NextResponse.json(
      { error: "That could not be saved." },
      { status: 503 },
    );
  }
}

export async function DELETE(req: Request) {
  const { user, error } = await memberSession();
  if (error) return error;
  const body = await readBody(req);
  if (!body)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const otherId = normaliseUsername(String(body.memberId ?? ""));
  if (!otherId)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    // Either side, at any time, without telling the other first.
    await removeConnection(user!.sub, otherId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[circle] removal failed", err);
    return NextResponse.json(
      { error: "That could not be saved." },
      { status: 503 },
    );
  }
}
