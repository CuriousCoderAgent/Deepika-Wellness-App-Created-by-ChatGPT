/**
 * Sending someone a bit of encouragement.
 *
 * This small endpoint is the part of the social feature with the strongest
 * evidence behind it. The research on social features in activity apps
 * separates two mechanisms: **social support**, which helps broadly, and
 * **social comparison**, which helps some people and drives others out —
 * particularly beginners, who withdraw or hide the app rather than be seen at
 * the bottom of something. Most members here are beginners. A nudge is support,
 * addressed to one person, with nobody ranked.
 *
 * Design constraints that follow:
 *
 * - **A fixed set of messages.** No free text. A nudge cannot become a channel
 *   for anything unkind, and nobody has to compose something.
 * - **Only between accepted connections**, checked here rather than assumed.
 * - **Rate limited per pair.** Three a day to the same person. Encouragement
 *   that arrives constantly is not encouragement.
 * - **Nothing about what she did.** A nudge says "thinking of you", never
 *   "you haven't moved in four days" — which is the same information turned
 *   into a reprimand.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import {
  countRecentNudges,
  createNudge,
  isConfigured,
  readCircleProfiles,
  readConnectionBetween,
  readNudgesFor,
} from "@/lib/db";
import { normaliseDisplayName } from "@/lib/circle";
import { MAX_NUDGES_PER_DAY, NUDGE_KINDS } from "@/lib/nudges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

async function memberOnly() {
  const user = await session();
  if (!user)
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
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

export async function POST(req: Request) {
  const { user, error } = await memberOnly();
  if (error) return error;

  const raw = await req.text();
  if (raw.length > 2_048)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let body: { memberId?: unknown; kind?: unknown };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const toId = String(body.memberId ?? "").trim().toLowerCase();
  const kind = String(body.kind ?? "");
  if (!toId || !NUDGE_KINDS[kind])
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (toId === user!.sub)
    return NextResponse.json({ error: "That is you." }, { status: 400 });

  try {
    // Encouragement is for people who agreed to be in each other's circle.
    const connection = await readConnectionBetween(user!.sub, toId);
    if (connection?.status !== "accepted")
      return NextResponse.json(
        { error: "You are not connected to that member." },
        { status: 403 },
      );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const already = await countRecentNudges(user!.sub, toId, since);
    if (already >= MAX_NUDGES_PER_DAY)
      return NextResponse.json(
        { error: "You have already sent her a few today. She will have seen them." },
        { status: 429 },
      );

    await createNudge({
      id: randomUUID(),
      fromId: user!.sub,
      toId,
      kind,
    });
    return NextResponse.json({ sent: true, message: NUDGE_KINDS[kind] });
  } catch (err) {
    console.error("[circle] nudge failed", err);
    return NextResponse.json(
      { error: "That could not be sent." },
      { status: 503 },
    );
  }
}

/** What has been sent to her recently, with who sent it. */
export async function GET() {
  const { user, error } = await memberOnly();
  if (error) return error;

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const nudges = await readNudgesFor(user!.sub, since);
    const profiles = await readCircleProfiles([
      ...new Set(nudges.map((n) => n.fromId)),
    ]);
    return NextResponse.json({
      nudges: nudges.map((nudge) => ({
        from: normaliseDisplayName(profiles.get(nudge.fromId)?.displayName),
        message: NUDGE_KINDS[nudge.kind] ?? NUDGE_KINDS.thinking_of_you,
        at: nudge.createdAt,
      })),
    });
  } catch (err) {
    console.error("[circle] nudge read failed", err);
    return NextResponse.json({ nudges: [] });
  }
}
