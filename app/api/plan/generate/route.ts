/**
 * Building today's plan for a member with no coach.
 *
 * The split here is the important part. **Rules decide what she does**:
 * `lib/plan-generator.ts` selects the movements, `lib/adaptation.ts` decides
 * whether each one goes up, holds or steps back, and both are pure and tested.
 * **A model only writes the sentence explaining it.** Progressive overload is
 * arithmetic and does not need a language model; what a model is better at is
 * saying "you have made this look easy twice running, so it is time for a bit
 * more" in a way that sounds like a person.
 *
 * That split is also what makes this safe to ship. If the model is slow, down,
 * or not configured, the plan is identical and the explanation falls back to a
 * written sentence. Nothing about her day depends on a model answering.
 *
 * A coach, where someone has one, wins outright: any domain she has authored
 * today is left exactly as she wrote it.
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { isConfigured, readMemberDoc, writeMemberDoc } from "@/lib/db";
import { todayIso } from "@/lib/day-offset";
import { evaluateReadiness } from "@/lib/readiness";
import { EXERCISE_BY_ID } from "@/lib/exercise-library";
import {
  generatePlan,
  type GeneratedExercise,
  type GeneratorInput,
} from "@/lib/plan-generator";
import {
  selectDailyActions,
  type DailyActionTemplate,
  type DomainSignals,
} from "@/lib/daily-actions-library";
import {
  nextDose,
  verdictFor,
  weekPostureFor,
  type DailySignal,
  type SessionRecord,
} from "@/lib/adaptation";
import type { MemberDoc } from "@/lib/persist";
import type { DailyAction } from "@/lib/types";

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
 * A domain counts as the coach's when she authored the action herself.
 *
 * The placeholder check-ins the app generates carry a `legacy-` id and are not
 * coach work — treating those as authored would mean a member who once had a
 * coach never receives a generated plan again.
 */
function coachAuthoredDomains(doc: MemberDoc): string[] {
  if (doc.coaching?.mode !== "coached") return [];
  // A coach may take a domain wholesale, whether or not she has published for
  // today yet — otherwise the generator would fill her movement slot every
  // morning before she got to it.
  const owned = doc.coaching.ownedDomains ?? [];
  return [
    ...new Set([
      ...owned,
      ...(doc.actions ?? [])
        .filter(
          (action) =>
            action.dayOffset === 0 &&
            action.provenance?.source === "coach_on_behalf" &&
            !action.id.startsWith("legacy-"),
        )
        .map((action) => action.domain ?? "movement"),
    ]),
  ];
}

/** Completed exercises, flattened for the adaptation rules. */
function sessionRecords(doc: MemberDoc): SessionRecord[] {
  const actionById = new Map((doc.actions ?? []).map((a) => [a.id, a]));
  return (doc.workoutLogs ?? []).flatMap((log) => {
    const raw = log as unknown as Record<string, unknown>;
    const action = actionById.get(String(raw.actionId ?? ""));
    const exerciseId =
      (typeof raw.exerciseId === "string" && raw.exerciseId) ||
      action?.exercise?.exerciseId ||
      (action?.exercise?.name && exerciseIdByName(action.exercise.name)) ||
      "";
    if (!exerciseId) return [];
    const completedAt = String(raw.completedAt ?? "");
    return [
      {
        exerciseId,
        perceivedEffort: Number(raw.perceivedEffort ?? raw.rpe ?? 3),
        level: (raw.level ?? raw.completedLevel ?? "target") as SessionRecord["level"],
        pain: Boolean(raw.pain ?? raw.painFlag),
        date: completedAt.slice(0, 10) || todayIso(),
      },
    ];
  });
}

function exerciseIdByName(name: string): string | null {
  for (const [id, exercise] of EXERCISE_BY_ID) {
    if (exercise.name.toLowerCase() === name.toLowerCase()) return id;
  }
  return null;
}

function dailySignals(doc: MemberDoc): DailySignal[] {
  return (doc.pulses ?? []).map((pulse) => {
    const raw = pulse as unknown as Record<string, unknown>;
    const offset = Number(raw.dayOffset ?? 0);
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return {
      date: date.toISOString().slice(0, 10),
      energy: Number(raw.energy ?? 0) || undefined,
      sleep: Number(raw.sleep ?? 0) || undefined,
      stress: Number(raw.stress ?? 0) || undefined,
    };
  });
}

/**
 * Move each exercise along its ladder, and record what changed.
 *
 * Pain is the one verdict that does more than adjust a number: the movement is
 * added to a paused list and is never offered again by generation. Only a
 * person takes it off that list.
 */
function applyAdaptation(doc: MemberDoc, records: SessionRecord[]) {
  const posture = weekPostureFor(dailySignals(doc)).posture;
  const steps: Record<string, number> = {
    ...((doc.doseSteps as Record<string, number> | undefined) ?? {}),
  };
  const paused = new Set(doc.pausedExerciseIds ?? []);
  const notes: string[] = [];

  for (const exerciseId of new Set(records.map((r) => r.exerciseId))) {
    const verdict = verdictFor(exerciseId, records);
    if (verdict.adjustment === "stop_and_review") {
      paused.add(exerciseId);
      notes.push(verdict.reason);
      continue;
    }
    const current = steps[exerciseId] ?? 0;
    const next = nextDose(current, verdict.adjustment, posture);
    steps[exerciseId] = next.step;
    if (next.changeExercise === "progress") {
      const harder = EXERCISE_BY_ID.get(exerciseId)?.progressesTo;
      if (harder) {
        steps[harder] = 0;
        notes.push(verdict.reason);
      }
    }
    if (verdict.adjustment !== "hold") notes.push(verdict.reason);
  }
  return { steps, paused: [...paused], posture, notes };
}

/**
 * What the other four domains should look like today.
 *
 * Every signal here was already being collected and read by nothing. Poor sleep
 * ratings now change what recovery offers; consistently low protein changes
 * what nutrition offers; whether a step source is connected decides between a
 * step target and a timed walk.
 */
function domainSignals(doc: MemberDoc, signals: DailySignal[]): DomainSignals {
  const week = signals.slice(-7);
  const rated = (pick: (s: DailySignal) => number | undefined) =>
    week.map(pick).filter((v): v is number => typeof v === "number" && v > 0);
  const sleep = rated((s) => s.sleep);
  const stress = rated((s) => s.stress);

  const today = todayIso();
  const recentFood = (doc.foodEntries ?? []).filter((entry) => {
    const raw = entry as unknown as Record<string, unknown>;
    const date = String(raw.loggedDate ?? "");
    return date >= shiftDate(today, -3);
  });
  const protein = recentFood.reduce(
    (sum, entry) => sum + Number((entry as unknown as Record<string, unknown>).protein ?? 0),
    0,
  );

  return {
    goals: doc.onboarding?.goals ?? [],
    // Two or more poor nights in the last week, not a single bad one.
    poorSleep: sleep.filter((value) => value <= 2).length >= 2,
    highStress: stress.filter((value) => value <= 2).length >= 2,
    lowFoodLogging: recentFood.length < 3,
    // Only claimed when she has logged enough for the figure to mean anything.
    lowProtein: recentFood.length >= 3 && protein / 3 < 40,
    stepsConnected: Boolean(doc.healthConnection?.syncEnabled),
    recentlyOffered: (doc.actions ?? [])
      .filter((action) => action.dayOffset >= -3 && action.dayOffset < 0)
      .map((action) => action.moduleId ?? "")
      .filter(Boolean),
  };
}

function shiftDate(date: string, days: number): string {
  const base = Date.parse(`${date}T12:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** A domain template becomes an action the existing Today screen understands. */
function toDomainAction(
  memberId: string,
  template: DailyActionTemplate,
): DailyAction {
  return {
    id: `generated-${memberId}-${template.id}-${todayIso()}`,
    memberId,
    dayOffset: 0,
    moduleId: template.id,
    domain: template.domain,
    title: template.title,
    why: template.why,
    minimum: { label: template.minimum, minutes: 0 },
    target: { label: template.target, minutes: 0 },
    stretch: { label: template.stretch, minutes: 0 },
    measurement: template.measurement,
    completed: null,
    provenance: {
      source: "system_derived",
      enteredBy: "bharosa",
      at: new Date().toISOString(),
    },
  } as unknown as DailyAction;
}

/** A generated exercise becomes an action the existing Today screen understands. */
function toAction(
  memberId: string,
  item: GeneratedExercise,
  index: number,
  why: string,
): DailyAction {
  return {
    id: `generated-${memberId}-${item.exerciseId}-${todayIso()}`,
    memberId,
    dayOffset: 0,
    moduleId: "ai-generated-session",
    domain: "movement",
    title: item.name,
    why,
    minimum: { label: "A shorter version is a complete day", minutes: item.minutes },
    target: { label: item.sets, minutes: item.minutes },
    stretch: { label: "Add one more set if it feels good", minutes: item.minutes + 2 },
    measurement: { kind: "minutes", value: item.minutes, unit: "minutes" },
    isPrimary: index === 0,
    completed: null,
    provenance: {
      source: "system_derived",
      enteredBy: "bharosa",
      at: new Date().toISOString(),
    },
    exercise: {
      exerciseId: item.exerciseId,
      name: item.name,
      sets: item.sets,
      cue: item.cue,
      frames: item.frames,
    },
  } as unknown as DailyAction;
}

/**
 * The one sentence a model writes.
 *
 * It is given the decisions already made and asked to phrase them. It cannot
 * change a movement, a set count, or a verdict, and its output is a single
 * short string that is length-capped before it is stored.
 */
async function explain(
  session: GeneratedExercise[],
  notes: string[],
  fallback: string,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY || !session.length) return fallback;
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_RECOMMENDATION_MODEL || "gpt-5",
      store: false,
      input: [
        {
          role: "developer",
          content:
            "You write one short sentence explaining today's movement plan to the woman following it. You are given decisions that have already been made; your only job is to phrase them warmly and plainly. Never add an exercise, change a set count, give medical or nutritional advice, mention weight or appearance, diagnose anything, or imply she is behind. Never mention streaks or missed days. One sentence, under 140 characters, second person.",
        },
        {
          role: "user",
          content: JSON.stringify({
            movements: session.map((s) => ({ name: s.name, sets: s.sets })),
            changesMade: notes.slice(0, 3),
          }),
        },
      ],
    });
    const text = response.output_text?.trim().replace(/\s+/g, " ");
    return text && text.length <= 200 ? text : fallback;
  } catch {
    // The plan is already decided. Losing the nicer sentence costs nothing.
    return fallback;
  }
}

export async function POST() {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "member")
    return NextResponse.json(
      { error: "Plans are generated for members." },
      { status: 403 },
    );
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured." },
      { status: 503 },
    );

  try {
    const doc = await readMemberDoc(user.sub);
    if (!doc)
      return NextResponse.json({ error: "No record found." }, { status: 404 });

    const records = sessionRecords(doc);
    const { steps, paused, notes } = applyAdaptation(doc, records);

    const readiness = doc.readiness
      ? {
          ...evaluateReadiness(doc.readiness.answers ?? {}),
        }
      : undefined;

    const input: GeneratorInput = {
      memberId: user.sub,
      week: doc.member?.week ?? 1,
      goals: doc.onboarding?.goals ?? [],
      availableMinutes: doc.onboarding?.availableMinutes ?? 15,
      activityLevel: doc.onboarding?.activityLevel,
      movementCaution: doc.onboarding?.movementCaution,
      readiness,
      doseSteps: steps,
      pausedExerciseIds: paused,
      signals: dailySignals(doc),
      coachAuthoredDomains: coachAuthoredDomains(doc),
    };

    const plan = generatePlan(input);
    const why = await explain(plan.session, notes, plan.rationale);

    // Generated actions replace only previous generated ones. A coach's work,
    // and anything the member has already completed today, is left alone.
    const keep = (doc.actions ?? []).filter(
      (action) =>
        action.dayOffset !== 0 ||
        !action.id.startsWith(`generated-${user.sub}-`) ||
        Boolean(action.completed),
    );
    const coachOwned = new Set(coachAuthoredDomains(doc));
    const domains = selectDailyActions(domainSignals(doc, dailySignals(doc)))
      .filter((template) => !coachOwned.has(template.domain))
      .map((template) => toDomainAction(user.sub, template));

    const generated = [
      ...plan.session.map((item, index) => toAction(user.sub, item, index, why)),
      ...domains,
    ];
    const alreadyThere = new Set(keep.map((a) => a.id));

    const next: MemberDoc = {
      ...doc,
      actions: [...keep, ...generated.filter((a) => !alreadyThere.has(a.id))],
      doseSteps: steps,
      pausedExerciseIds: paused,
      planGeneratedOn: todayIso(),
    } as MemberDoc;

    await writeMemberDoc(user.sub, next);

    return NextResponse.json({
      generated: generated.length,
      domains: domains.length,
      posture: plan.posture,
      rationale: why,
      movementHeld: plan.movementHeld ?? null,
      changes: notes.slice(0, 3),
    });
  } catch (err) {
    console.error("[plan] generation failed", err);
    return NextResponse.json(
      { error: "Your plan could not be built just now." },
      { status: 503 },
    );
  }
}
