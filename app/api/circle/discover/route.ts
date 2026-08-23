/**
 * Finding other members in the same city.
 *
 * Two ways to be found: the city she typed, and — if she has allowed it — the
 * area she is in. There are no coordinates here and no distances. Her device
 * coarsens its position to roughly a three-kilometre grid cell before sending
 * it, so what the server holds is two integers naming a square, and what
 * another member sees is "nearby" or "in your area".
 *
 * The coarsening is the whole safety argument and it happens on the phone, not
 * here. A precise position that reached the server would be a precise position
 * the server could leak, log, or be compelled to produce, whatever it then did
 * with it. And a distance in kilometres, sampled a few times as either person
 * moves, locates a home; a bucket does not.
 *
 * Discovery is mutual by construction: only members who opted in are listed,
 * and being listed exposes nothing beyond a name and a city until a request is
 * accepted.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import {
  discoverByCity,
  discoverNearby,
  isConfigured,
  readCircleProfile,
} from "@/lib/db";
import { normaliseDisplayName } from "@/lib/circle";
import { cellsWithin, proximityBetween, proximityLabel } from "@/lib/proximity";

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
    if (!profile.city && profile.cellX === null)
      return NextResponse.json({
        city: null,
        members: [],
        message:
          "Add your city, or share your area, to find other members near you.",
      });

    // Symmetry on purpose: a member who is not discoverable herself cannot
    // browse the list either. Otherwise the safest setting would be to look
    // without being seen, and nobody would opt in.
    if (!profile.discoverable)
      return NextResponse.json({
        city: profile.city,
        members: [],
        message:
          "Turn on ‘Let other members find me’ to see who else is nearby.",
      });

    const myCell =
      profile.cellX !== null && profile.cellY !== null
        ? { x: profile.cellX, y: profile.cellY }
        : null;

    // Area first when she has shared one, because "nearby" is what she asked
    // for; the city is the fallback for anyone who has not.
    const found = myCell
      ? await discoverNearby(user.sub, cellsWithin(myCell))
      : profile.city
        ? await discoverByCity(user.sub, profile.city)
        : [];

    return NextResponse.json({
      city: profile.city,
      basis: myCell ? "area" : "city",
      members: found.map((row) => {
        const theirCell =
          row.cellX !== null && row.cellY !== null
            ? { x: row.cellX, y: row.cellY }
            : null;
        return {
          memberId: row.userId,
          displayName: normaliseDisplayName(row.displayName),
          bio: row.bio ?? undefined,
          city: row.city ?? undefined,
          proximityLabel: proximityLabel(proximityBetween(myCell, theirCell)),
        };
      }),
    });
  } catch (err) {
    console.error("[circle] discovery failed", err);
    return NextResponse.json(
      { error: "Discovery is temporarily unavailable." },
      { status: 503 },
    );
  }
}
