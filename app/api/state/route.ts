/**
 * The signed-in account's data.
 *
 * GET  loads it. A member gets her own document and nothing else; Deepika gets
 *      every member's document, which is what makes the console show real
 *      activity instead of only the demo cohort.
 * PUT  saves it back, scoped the same way.
 *
 * Which account is being read or written is taken from the signed session
 * cookie, never from the request body. A member cannot ask for someone else's
 * record by changing an id, because there is no id to change.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import {
  isConfigured,
  readAllMemberDocs,
  readCoachDoc,
  readMemberDoc,
  writeCoachDoc,
  writeMemberDoc,
} from "@/lib/db";
import type { CoachDoc, MemberDoc } from "@/lib/persist";
import type { Report } from "@/lib/types";
import { evaluateReadiness, type ReadinessState } from "@/lib/readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

/**
 * Mobile captures a document first; the coach console can later add transcribed
 * values. Convert that capture to the shared report schema at the trust
 * boundary so neither surface has to understand the other's legacy shape.
 */
function normalizeIncomingReport(
  report: Report & Record<string, unknown>,
  memberId: string,
): Report {
  const uploadedAt =
    typeof report.uploadedAt === "string"
      ? report.uploadedAt
      : (report.provenance?.at ?? new Date().toISOString());
  const mobileCategory =
    typeof report.category === "string" ? report.category : undefined;
  const kind =
    report.kind ??
    (mobileCategory === "body_composition"
      ? "body_composition"
      : mobileCategory === "other"
        ? "other"
        : "blood_panel");
  return {
    id: report.id,
    memberId,
    kind,
    title: report.title || "Uploaded report",
    collectedOn: report.collectedOn || uploadedAt.slice(0, 10),
    lab: report.lab,
    fileName: report.fileName,
    fileId: typeof report.fileId === "string" ? report.fileId : undefined,
    values: Array.isArray(report.values) ? report.values : [],
    provenance: report.provenance ?? {
      source: "imported_document",
      enteredBy: memberId,
      at: uploadedAt,
    },
    note: report.note,
  };
}

/**
 * Mobile saves are intentionally field-scoped. A member can record her own
 * observations and completion, but cannot replace coach-authored action
 * definitions, sessions, or the published 12-week plan with a stale client
 * copy. This also keeps a newly arrived coach message when a member saves an
 * older screen a moment later.
 */
/**
 * Her answers are hers; the outcome is not.
 *
 * The screen decides whether a movement plan is offered at all, so the verdict
 * is recomputed here from the answers rather than accepted from the client. An
 * app that posted `outcome: "clear"` would otherwise unlock movements for
 * someone the screen had held back.
 */
function mergeReadiness(
  existing: ReadinessState | undefined,
  incoming: ReadinessState | undefined,
): ReadinessState | undefined {
  const source = incoming ?? existing;
  if (!source) return undefined;
  return {
    ...source,
    ...evaluateReadiness(source.answers ?? {}),
  };
}

/**
 * Combine two copies of an append-only log without losing either side's rows.
 *
 * These arrays used to be replaced wholesale by whatever the phone sent, which
 * quietly lost records the moment two devices existed:
 *
 *   1. Phone A goes offline holding yesterday's food.
 *   2. Phone B logs breakfast online.
 *   3. Phone A logs lunch and reconnects.
 *   4. Phone A sends its whole array, and breakfast is gone.
 *
 * Nothing errored, and nobody was told. A union by id preserves both — the
 * incoming copy wins for rows it has, because those are the ones the member
 * just edited, and rows only the server has are kept, because they came from
 * somewhere this device has not seen yet.
 *
 * This works because these logs are append-and-edit only: nothing in the
 * product deletes a pulse, a workout log or a food entry. **When deletion is
 * added, this becomes wrong** — a union will resurrect whatever was deleted —
 * and it will need tombstones, or these writes need to become real commands
 * rather than a whole document.
 */
function unionById<T extends { id?: string }>(
  existing: T[] | undefined,
  incoming: T[] | undefined,
): T[] {
  if (!incoming) return existing ?? [];
  if (!existing?.length) return incoming;
  const merged = new Map<string, T>();
  // Server first, so an incoming row with the same id replaces it.
  for (const row of existing) if (row?.id) merged.set(row.id, row);
  for (const row of incoming) if (row?.id) merged.set(row.id, row);
  // Anything without an id cannot be matched up; keep the incoming copy only,
  // which is the old behaviour and no worse than it was.
  const idless = incoming.filter((row) => !row?.id);
  return [...merged.values(), ...idless];
}

function mergeMemberUpdate(
  existing: MemberDoc,
  incoming: MemberDoc,
  memberId: string,
): MemberDoc {
  const incomingActions = new Map(
    (incoming.actions ?? []).map((action) => [action.id, action]),
  );
  const existingActionIds = new Set(
    (existing.actions ?? []).map((action) => action.id),
  );
  const safeLegacyPrefix = `legacy-${memberId}-`;
  const generatedCheckIns = (incoming.actions ?? [])
    .filter(
      (action) =>
        !existingActionIds.has(action.id) &&
        action.id.startsWith(safeLegacyPrefix),
    )
    .map((action) => ({
      ...action,
      memberId,
      moduleId: action.moduleId || "member-baseline-check-in",
      workoutId: undefined,
      coachLimits: undefined,
    }));
  const actions = (existing.actions ?? []).map((action) => {
    const update = incomingActions.get(action.id);
    return update
      ? {
          ...action,
          completed: update.completed,
          skipReason: update.skipReason,
          skipKind: update.skipKind,
        }
      : action;
  });

  const incomingMessages = new Map(
    (incoming.messages ?? []).map((message) => [message.id, message]),
  );
  const existingMessageIds = new Set(
    (existing.messages ?? []).map((message) => message.id),
  );
  const messages = [
    ...(existing.messages ?? []).map((message) => {
      const update = incomingMessages.get(message.id);
      return update ? { ...message, read: update.read } : message;
    }),
    ...(incoming.messages ?? [])
      .filter(
        (message) =>
          !existingMessageIds.has(message.id) && message.from === "member",
      )
      .map((message) => ({ ...message, memberId })),
  ];

  const existingReportIds = new Set(
    (existing.reports ?? []).map((report) => report.id),
  );
  const reports = [
    ...(existing.reports ?? []),
    ...(incoming.reports ?? [])
      .filter((report) => !existingReportIds.has(report.id))
      .map((report) =>
        normalizeIncomingReport(
          report as Report & Record<string, unknown>,
          memberId,
        ),
      ),
  ];

  return {
    ...existing,
    member: {
      ...existing.member,
      id: memberId,
      goals: incoming.member.goals ?? existing.member.goals,
      constraints: incoming.member.constraints ?? existing.member.constraints,
      checkInPreference:
        incoming.onboarding?.preferredCheckIn ??
        existing.member.checkInPreference,
    },
    actions: [...actions, ...generatedCheckIns],
    // Unioned, not replaced — see unionById. A second device must not be
    // able to erase what the first one logged.
    pulses: unionById(existing.pulses, incoming.pulses).map((entry) => ({
      ...entry,
      memberId,
    })),
    workoutLogs: unionById(existing.workoutLogs, incoming.workoutLogs).map(
      (entry) => ({
        ...entry,
        memberId,
      }),
    ),
    messages,
    sessions: existing.sessions ?? [],
    reports,
    foodEntries: unionById(existing.foodEntries, incoming.foodEntries).map(
      (entry) => ({
        ...entry,
        memberId,
      }),
    ),
    // Hydration, habits and their logs are hers alone: the coach console has
    // no editor for them, so the member's copy is authoritative.
    hydrationLogs: unionById(
      existing.hydrationLogs,
      incoming.hydrationLogs,
    ).map((entry) => ({ ...entry, memberId })),
    habits: (incoming.habits ?? existing.habits ?? []).map((entry) => ({
      ...entry,
      memberId,
    })),
    habitLogs: (incoming.habitLogs ?? existing.habitLogs ?? []).map(
      (entry) => ({
        ...entry,
        memberId,
      }),
    ),
    // Hers for the same reason. This was absent from the server type
    // altogether, so the merge dropped it on every sync and a reminder she
    // had just switched on came back off on the next read.
    engagement: incoming.engagement ?? existing.engagement,
    readiness: mergeReadiness(existing.readiness, incoming.readiness),
    // Derived by the generator from logged sessions, never accepted from the
    // phone: otherwise a client could award itself a heavier dose, or quietly
    // un-pause a movement that hurt.
    doseSteps: existing.doseSteps,
    doseAdaptedThrough: existing.doseAdaptedThrough,
    pausedExerciseIds: existing.pausedExerciseIds,
    planGeneratedOn: existing.planGeneratedOn,
    // A coaching subscription is established elsewhere. A member's own app
    // cannot grant or revoke it by posting a document.
    coaching: existing.coaching,
    healthConnection: incoming.healthConnection ?? existing.healthConnection,
    healthSnapshots: incoming.healthSnapshots ?? existing.healthSnapshots ?? [],
    recommendations: incoming.recommendations ?? existing.recommendations ?? [],
    onboarding: incoming.onboarding ?? existing.onboarding,
  };
}

export async function GET() {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // Not an error. It is the honest answer to "is there a database", and the
  // client uses it to decide whether to fall back to browser storage.
  if (!isConfigured()) return NextResponse.json({ configured: false });

  try {
    if (user.role === "coach") {
      const [docs, coach] = await Promise.all([
        readAllMemberDocs(),
        readCoachDoc(user.sub),
      ]);
      return NextResponse.json({ configured: true, docs, coach });
    }
    return NextResponse.json({
      configured: true,
      doc: await readMemberDoc(user.sub),
    });
  } catch (err) {
    console.error("[state] read failed", err);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}

export async function PUT(req: Request) {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ configured: false });

  let body: { doc?: MemberDoc; docs?: MemberDoc[]; coach?: CoachDoc };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  try {
    if (user.role === "coach") {
      // Deepika edits members — publishes a week, sends a message, adds a
      // note — so she writes to their documents. Only the ones that actually
      // changed are sent, which keeps her from stamping her copy of the
      // cohort over a member who logged something a moment ago.
      for (const doc of body.docs ?? []) {
        if (doc?.member?.id) await writeMemberDoc(doc.member.id, doc);
      }
      if (body.coach) await writeCoachDoc(user.sub, body.coach);
      return NextResponse.json({ ok: true });
    }

    const doc = body.doc;
    if (!doc?.member)
      return NextResponse.json({ error: "Missing document" }, { status: 400 });
    const existing = await readMemberDoc(user.sub);
    if (!existing)
      return NextResponse.json(
        { error: "Member record not found" },
        { status: 404 },
      );
    await writeMemberDoc(user.sub, mergeMemberUpdate(existing, doc, user.sub));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[state] write failed", err);
    return NextResponse.json({ error: "Storage unavailable" }, { status: 503 });
  }
}
