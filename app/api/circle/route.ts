/**
 * A member's circle: who she is connected to, and how their day is going.
 *
 * GET returns her own settings, her accepted connections with their activity,
 * and any requests waiting on her. PUT updates her settings.
 *
 * The activity in the response is built by `lib/circle.ts`, which constructs a
 * projection field by field and never spreads a member document. Nothing about
 * meals, photos, reports, mood, symptoms or coach messages can reach another
 * member through this route.
 *
 * Two switches gate it, both off until she turns them on. `shareActivity`
 * decides whether her connections see anything at all; `shareSteps` decides
 * whether her step count is part of it. Someone who shares nothing still sees
 * her friends — a member should be able to be encouraged by other people
 * without broadcasting her own day to get it.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import {
  isConfigured,
  readCircleProfile,
  readCircleProfiles,
  readConnectionsFor,
  readMemberDoc,
  writeCircleProfile,
  type StoredCircleProfile,
} from "@/lib/db";
import {
  activityFor,
  normaliseCity,
  normaliseDisplayName,
  rankByConsistency,
  type CircleActivity,
} from "@/lib/circle";
import { todayIso } from "@/lib/day-offset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

function publicProfile(profile: StoredCircleProfile) {
  return {
    displayName: profile.displayName,
    city: profile.city ?? undefined,
    discoverable: profile.discoverable,
    shareActivity: profile.shareActivity,
    shareSteps: profile.shareSteps,
  };
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
    const [profile, connections] = await Promise.all([
      readCircleProfile(user.sub),
      readConnectionsFor(user.sub),
    ]);

    const accepted = connections.filter((c) => c.status === "accepted");
    const otherIds = accepted.map((c) =>
      c.requesterId === user.sub ? c.addresseeId : c.requesterId,
    );
    const incoming = connections.filter(
      (c) => c.status === "pending" && c.addresseeId === user.sub,
    );
    const outgoing = connections.filter(
      (c) => c.status === "pending" && c.requesterId === user.sub,
    );

    const pendingIds = [
      ...incoming.map((c) => c.requesterId),
      ...outgoing.map((c) => c.addresseeId),
    ];
    const profiles = await readCircleProfiles([...otherIds, ...pendingIds]);

    // One document read per connection. The pilot circle is small; if this ever
    // grows, the projection is what to cache, never the documents themselves.
    const activities: CircleActivity[] = [];
    const today = todayIso();
    for (const otherId of otherIds) {
      const theirProfile = profiles.get(otherId);
      if (!theirProfile) continue;
      if (!theirProfile.shareActivity) {
        // Connected, but she has not turned sharing on. Show that she is here
        // without inventing numbers for her.
        activities.push({
          memberId: otherId,
          displayName: normaliseDisplayName(theirProfile.displayName),
          actionsCompleted: 0,
          actionsTotal: 0,
          activeDays: 0,
          city: theirProfile.city ?? undefined,
        });
        continue;
      }
      const doc = await readMemberDoc(otherId).catch(() => null);
      const activity = activityFor(otherId, doc, theirProfile, today);
      if (!theirProfile.shareSteps) delete activity.steps;
      activities.push(activity);
    }

    const me = activityFor(
      user.sub,
      await readMemberDoc(user.sub).catch(() => null),
      profile,
      today,
    );

    return NextResponse.json({
      profile: publicProfile(profile),
      // Her own row is included so the app can show where she sits without
      // recomputing it differently on the device.
      me,
      circle: rankByConsistency(activities),
      requests: {
        incoming: incoming.map((c) => ({
          memberId: c.requesterId,
          displayName: normaliseDisplayName(
            profiles.get(c.requesterId)?.displayName,
          ),
          city: profiles.get(c.requesterId)?.city ?? undefined,
          requestedAt: c.createdAt,
        })),
        outgoing: outgoing.map((c) => ({
          memberId: c.addresseeId,
          displayName: normaliseDisplayName(
            profiles.get(c.addresseeId)?.displayName,
          ),
          city: profiles.get(c.addresseeId)?.city ?? undefined,
          requestedAt: c.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("[circle] read failed", err);
    return NextResponse.json(
      { error: "The circle is temporarily unavailable." },
      { status: 503 },
    );
  }
}

export async function PUT(req: Request) {
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

  const raw = await req.text();
  if (raw.length > 8_192)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  try {
    const existing = await readCircleProfile(user.sub);
    const city = normaliseCity(body.city);
    const next: StoredCircleProfile = {
      userId: user.sub,
      displayName: normaliseDisplayName(
        body.displayName,
        existing.displayName || user.name || "",
      ),
      city: "city" in body ? city : existing.city,
      discoverable:
        typeof body.discoverable === "boolean"
          ? body.discoverable
          : existing.discoverable,
      shareActivity:
        typeof body.shareActivity === "boolean"
          ? body.shareActivity
          : existing.shareActivity,
      shareSteps:
        typeof body.shareSteps === "boolean"
          ? body.shareSteps
          : existing.shareSteps,
    };

    // Being findable in a city is meaningless without a city, and leaving the
    // flag on with the city cleared would be a setting that silently does
    // nothing.
    if (!next.city) next.discoverable = false;

    await writeCircleProfile(next);
    return NextResponse.json({ profile: publicProfile(next) });
  } catch (err) {
    console.error("[circle] settings write failed", err);
    return NextResponse.json(
      { error: "Your settings could not be saved." },
      { status: 503 },
    );
  }
}
