/**
 * Finding other members in the same city.
 *
 * City is the most precise location this feature ever handles. There are no
 * coordinates, no distance, no map and no "last seen". A member who is
 * discoverable appears to others in her city as a chosen display name and that
 * city — which is what she typed, not something derived from her device.
 *
 * That is a deliberate limit rather than a first version. The people using this
 * are women logging when they exercise; a feature that told a stranger roughly
 * where one of them is, and that she goes walking each morning, would be a
 * different and much worse product than the one being asked for.
 *
 * Discovery is mutual by construction: only members who opted in are listed,
 * and being listed exposes nothing beyond a name and a city until a request is
 * accepted.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { discoverByCity, isConfigured, readCircleProfile } from "@/lib/db";
import { normaliseDisplayName } from "@/lib/circle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

export async function GET() {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "member")
    return NextResponse.json(
      { error: "The circle is a member feature." },
      { status: 403 },
    );
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );

  try {
    const profile = await readCircleProfile(user.sub);
    if (!profile.city)
      return NextResponse.json({
        city: null,
        members: [],
        message: "Add your city to find other members near you.",
      });

    // Symmetry on purpose: a member who is not discoverable herself cannot
    // browse the list either. Otherwise the safest setting would be to look
    // without being seen, and nobody would opt in.
    if (!profile.discoverable)
      return NextResponse.json({
        city: profile.city,
        members: [],
        message:
          "Turn on ‘Let members in my city find me’ to see who else is nearby.",
      });

    const found = await discoverByCity(user.sub, profile.city);
    return NextResponse.json({
      city: profile.city,
      members: found.map((row) => ({
        memberId: row.userId,
        displayName: normaliseDisplayName(row.displayName),
        city: row.city ?? undefined,
      })),
    });
  } catch (err) {
    console.error("[circle] discovery failed", err);
    return NextResponse.json(
      { error: "Discovery is temporarily unavailable." },
      { status: 503 },
    );
  }
}
