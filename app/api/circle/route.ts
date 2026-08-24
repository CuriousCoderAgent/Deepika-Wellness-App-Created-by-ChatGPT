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
import {
  consistencyFor,
  circleTotal,
  type ConsistencySummary,
} from "@/lib/consistency";
import { proximityBetween, toCell } from "@/lib/proximity";
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
    bio: profile.bio ?? undefined,
    city: profile.city ?? undefined,
    // The cell is never returned. She is told whether she has shared a
    // location, not what it is.
    hasLocation: profile.cellX !== null && profile.cellY !== null,
    discoverable: profile.discoverable,
    shareActivity: profile.shareActivity,
    shareSteps: profile.shareSteps,
  };
}

/**
 * The last four weeks, as a pattern rather than a position.
 *
 * Built from the same document the activity projection reads, and just as
 * strictly: dates only, no content. Knowing someone showed up on the 14th says
 * nothing about what she ate or how she felt.
 */
function consistencyFrom(
  doc: Awaited<ReturnType<typeof readMemberDoc>>,
): ConsistencySummary {
  const active = new Set<string>();
  const movement = new Set<string>();
  const logged = new Set<string>();
  const dayOf = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

  for (const action of doc?.actions ?? []) {
    if (!action.completed || action.dayOffset > 0 || action.dayOffset < -27)
      continue;
    const date = dayOf(action.dayOffset);
    active.add(date);
    if ((action.domain ?? "movement") === "movement") movement.add(date);
  }
  // Tombstoned meals are removed, not logged. A day whose only entry she
  // deleted must not still count as a day she logged something.
  for (const entry of (doc?.foodEntries ?? []).filter((e) => !e.deletedAt)) {
    const date = String(
      (entry as unknown as Record<string, unknown>).loggedDate ?? "",
    );
    if (date) logged.add(date);
  }
  for (const entry of doc?.hydrationLogs ?? []) logged.add(entry.date);
  for (const pulse of doc?.pulses ?? []) {
    if (pulse.dayOffset <= 0 && pulse.dayOffset >= -27)
      logged.add(dayOf(pulse.dayOffset));
  }
  return consistencyFor({
    activeDates: [...active],
    movementDates: [...movement],
    loggedDates: [...logged],
  });
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
      activities.push({
        ...activity,
        bio: theirProfile.bio ?? undefined,
        consistency: consistencyFrom(doc),
        proximity: proximityBetween(
          profile.cellX !== null && profile.cellY !== null
            ? { x: profile.cellX, y: profile.cellY }
            : null,
          theirProfile.cellX !== null && theirProfile.cellY !== null
            ? { x: theirProfile.cellX, y: theirProfile.cellY }
            : null,
        ),
      } as CircleActivity);
    }

    const myDoc = await readMemberDoc(user.sub).catch(() => null);
    const myConsistency = consistencyFrom(myDoc);
    const me = {
      ...activityFor(user.sub, myDoc, profile, today),
      bio: profile.bio ?? undefined,
      consistency: myConsistency,
    } as CircleActivity;

    return NextResponse.json({
      profile: publicProfile(profile),
      // Her own row is included so the app can show where she sits without
      // recomputing it differently on the device.
      me,
      circle: rankByConsistency(activities),
      // Cooperative rather than competitive: everyone's days add and nobody's
      // subtract, so a quiet week dilutes the total slightly instead of putting
      // someone at the bottom of a ladder.
      together: circleTotal([
        myConsistency,
        ...activities
          .map(
            (a) =>
              (a as CircleActivity & { consistency?: ConsistencySummary })
                .consistency,
          )
          .filter((c): c is ConsistencySummary => Boolean(c)),
      ]),
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

/** A cell is two integers. Anything else is rejected, not repaired. */
function readCell(raw: unknown): { x: number; y: number } | null {
  const cell = raw as { x?: unknown; y?: unknown } | null;
  if (!cell) return null;
  const x = Number(cell.x);
  const y = Number(cell.y);
  return Number.isInteger(x) && Number.isInteger(y) ? { x, y } : null;
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
      bio:
        "bio" in body
          ? typeof body.bio === "string" && body.bio.trim()
            ? body.bio.trim().slice(0, 240)
            : null
          : existing.bio,
      // The app sends a grid cell it has already coarsened. Anything that looks
      // like a raw coordinate is refused rather than quietly rounded here — the
      // precision must be destroyed on the device, not in transit.
      cellX: "cell" in body ? (readCell(body.cell)?.x ?? null) : existing.cellX,
      cellY: "cell" in body ? (readCell(body.cell)?.y ?? null) : existing.cellY,
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

    // Being findable is meaningless with neither a city nor an area, and
    // leaving the flag on would be a setting that silently does nothing.
    if (!next.city && next.cellX === null) next.discoverable = false;

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
