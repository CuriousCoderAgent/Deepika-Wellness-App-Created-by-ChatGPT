import OpenAI from "openai";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { isConfigured, readMemberDoc, writeMemberDoc } from "@/lib/db";
import type {
  AiRecommendation,
  DailyAction,
  HealthSnapshot,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = new Set<AiRecommendation["kind"]>([
  "reorder_actions",
  "change_action_level",
  "adjust_reminder",
  "reduce_target",
  "coach_review",
  "no_change",
]);

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(bearer ?? (await cookies()).get(sessionCookieName)?.value);
}

type RecommendationDoc = NonNullable<Awaited<ReturnType<typeof readMemberDoc>>>;

type CompatibleWorkoutLog = {
  actionId?: string;
  workoutId?: string;
  pain?: boolean;
  painFlag?: boolean;
  coachReviewRequired?: boolean;
};

const HORMONE_OR_CLINICAL_LANGUAGE =
  /\b(body\s*signals?|symptoms?|pain(?:ful)?|injur(?:y|ed)|bleed(?:ing)?|hot\s*(?:flash|flush)(?:es)?|night\s*sweats?|dizz(?:y|iness)|faint(?:ing)?|palpitations?|cramps?|cramping|pregnan(?:t|cy)|hormon(?:e|al|es)?|progesterone|oestrogen|estrogen|testosterone|cortisol|thyroid|perimenopaus(?:e|al)?|menopaus(?:e|al)?|postmenopaus(?:e|al)?|menstrual|diagnos(?:e|ed|is|tic)|clinical|medications?|dosage|prescri(?:be|bed|ption)|blood\s*(?:test|work)|lab\s*(?:test|result)|disease|syndrome)\b/i;

function workoutLogsFor(doc: RecommendationDoc): CompatibleWorkoutLog[] {
  return (doc.workoutLogs ?? []) as unknown as CompatibleWorkoutLog[];
}

function painFlagFor(doc: RecommendationDoc) {
  return [...workoutLogsFor(doc)]
    .reverse()
    .find(
      (log) => log.pain || log.painFlag || log.coachReviewRequired === true,
    );
}

/**
 * Safety signals are evaluated before any model call. The model must never be
 * asked to improvise around pain or a member-reported body signal.
 */
function deterministicSafetyRecommendation(
  doc: RecommendationDoc,
): AiRecommendation | null {
  const now = new Date().toISOString();
  const pain = painFlagFor(doc);
  if (pain) {
    return {
      id: `recommendation-${Date.now()}`,
      createdAt: now,
      kind: "coach_review",
      actionId: pain.actionId ?? pain.workoutId,
      evidence: ["A recent movement was logged with pain"],
      rationale:
        "Pain needs human review. Bharosa has not substituted or prescribed another exercise.",
      confidence: 1,
      safety: "coach_review",
      status: "needs_coach_review",
      source: "deterministic",
    };
  }

  const bodySignal =
    (doc.pulses ?? []).some(
      (pulse) => pulse.dayOffset >= -7 && (pulse.symptoms?.length ?? 0) > 0,
    ) ||
    [...(doc.member.constraints ?? []), ...(doc.member.goals ?? [])].some(
      (value) => HORMONE_OR_CLINICAL_LANGUAGE.test(value),
    );
  if (bodySignal) {
    return {
      id: `recommendation-${Date.now()}`,
      createdAt: now,
      kind: "coach_review",
      evidence: ["A recent check-in includes a member-reported body signal"],
      rationale:
        "A coach should review this check-in. Bharosa has not inferred a cause or changed the plan in response.",
      confidence: 1,
      safety: "coach_review",
      status: "needs_coach_review",
      source: "deterministic",
    };
  }

  return null;
}

function deterministicRecommendation(
  doc: NonNullable<Awaited<ReturnType<typeof readMemberDoc>>>,
): AiRecommendation {
  const now = new Date().toISOString();
  const recent = (doc.pulses ?? []).filter((pulse) => pulse.dayOffset >= -3);
  const lowRecovery =
    recent.length > 0 &&
    recent.every(
      (pulse) => pulse.energy <= 2 || (pulse.sleep > 0 && pulse.sleep <= 2),
    );
  const action = (doc.actions ?? []).find((item) => item.dayOffset === 0);
  if (lowRecovery && action) {
    return {
      id: `recommendation-${Date.now()}`,
      createdAt: now,
      kind: "change_action_level",
      actionId: action.id,
      evidence: ["Recent energy or sleep check-ins are below your usual range"],
      rationale:
        "Use the coach-approved minimum today so the routine stays achievable while recovery catches up.",
      confidence: 0.86,
      previousValue: "target",
      proposedValue: "minimum",
      safety: "low_risk",
      status: "proposed",
      source: "deterministic",
    };
  }

  return {
    id: `recommendation-${Date.now()}`,
    createdAt: now,
    kind: "no_change",
    evidence: [
      "No safety trigger or clear recovery pattern requires an adjustment",
    ],
    rationale: "Your last approved plan remains the best starting point today.",
    confidence: 0.92,
    safety: "low_risk",
    status: "proposed",
    source: "deterministic",
  };
}

function compactInput(
  doc: NonNullable<Awaited<ReturnType<typeof readMemberDoc>>>,
) {
  const actions = (doc.actions ?? []).filter(
    (action) => action.dayOffset === 0,
  );
  const recentPulses = (doc.pulses ?? [])
    .filter((pulse) => pulse.dayOffset >= -7)
    .map(({ dayOffset, energy, sleep, stress, symptoms }) => ({
      dayOffset,
      energy,
      sleep,
      stress,
      // Symptoms may contain sensitive free text. Only the presence and count
      // are useful to the safety boundary; their content stays with the coach.
      bodySignalReported: (symptoms?.length ?? 0) > 0,
      bodySignalCount: symptoms?.length ?? 0,
    }));
  const recentHealth = ((doc.healthSnapshots ?? []) as HealthSnapshot[])
    .filter((snapshot) => snapshot.available)
    .slice(-28)
    .map(({ date, metric, value, unit, source }) => ({
      date,
      metric,
      value,
      unit,
      source,
    }));
  const recentFood = (doc.foodEntries ?? [])
    .filter((entry) => entry.dayOffset >= -7)
    .map((entry) => ({
      dayOffset: entry.dayOffset,
      calories: entry.calories ?? null,
      protein: entry.protein,
      confidence: entry.confidence ?? "member",
    }));
  return {
    goals: doc.onboarding?.goals?.slice(0, 3) ?? doc.member.goals.slice(0, 3),
    constraints: doc.member.constraints.slice(0, 6),
    availableMinutes: doc.onboarding?.availableMinutes ?? null,
    checkInPreference: doc.onboarding?.preferredCheckIn ?? null,
    recentPulses,
    recentHealth,
    foodSummary: recentFood,
    adherence: {
      completedActions: (doc.actions ?? []).filter(
        (action) =>
          action.dayOffset >= -7 &&
          action.completed &&
          action.completed !== "rest",
      ).length,
      plannedActions: (doc.actions ?? []).filter(
        (action) => action.dayOffset >= -7,
      ).length,
    },
    painFlagPresent: Boolean(painFlagFor(doc)),
    todayActions: actions.map((action: DailyAction) => ({
      id: action.id,
      title: action.title,
      domain: action.domain ?? action.moduleId,
      minimum: action.minimum,
      target: action.target,
      stretch: action.stretch,
      coachLimits: action.coachLimits ?? null,
    })),
  };
}

const recommendationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: [
        "reorder_actions",
        "change_action_level",
        "adjust_reminder",
        "reduce_target",
        "coach_review",
        "no_change",
      ],
    },
    actionId: { type: ["string", "null"] },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    rationale: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    previousValue: { type: ["string", "number", "null"] },
    proposedValue: { type: ["string", "number", "null"] },
    safety: { type: "string", enum: ["low_risk", "coach_review"] },
  },
  required: [
    "kind",
    "actionId",
    "evidence",
    "rationale",
    "confidence",
    "previousValue",
    "proposedValue",
    "safety",
  ],
} as const;

function guardRecommendation(
  candidate: Partial<AiRecommendation>,
  doc: NonNullable<Awaited<ReturnType<typeof readMemberDoc>>>,
): AiRecommendation | null {
  if (!candidate.kind || !ALLOWED_KINDS.has(candidate.kind)) return null;
  if (
    !Array.isArray(candidate.evidence) ||
    !candidate.evidence.length ||
    typeof candidate.rationale !== "string"
  )
    return null;
  const generatedLanguage = [
    candidate.rationale,
    ...candidate.evidence,
    candidate.previousValue,
    candidate.proposedValue,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
  if (
    candidate.safety === "coach_review" ||
    HORMONE_OR_CLINICAL_LANGUAGE.test(generatedLanguage)
  ) {
    return {
      id: `recommendation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: "coach_review",
      actionId: candidate.actionId || undefined,
      evidence: [
        "The generated suggestion requires human review before it can affect the plan",
      ],
      rationale:
        "A coach must review body-signal, hormone-related, or clinical interpretations. Bharosa has not applied this suggestion.",
      confidence: 1,
      safety: "coach_review",
      status: "needs_coach_review",
      source: "openai",
    };
  }
  const actions = (doc.actions ?? []).filter(
    (action) => action.dayOffset === 0,
  );
  const action = candidate.actionId
    ? actions.find((item) => item.id === candidate.actionId)
    : undefined;
  if (
    ["change_action_level", "reduce_target"].includes(candidate.kind) &&
    !action
  )
    return null;
  if (
    candidate.kind === "change_action_level" &&
    !["minimum", "target", "stretch"].includes(String(candidate.proposedValue))
  )
    return null;
  if (candidate.kind === "reduce_target") {
    const value = Number(candidate.proposedValue);
    if (
      !action?.coachLimits ||
      !Number.isFinite(value) ||
      value < action.coachLimits.minimumValue ||
      value > action.coachLimits.maximumValue
    )
      return null;
  }
  const safety =
    candidate.kind === "coach_review" ? "coach_review" : "low_risk";
  return {
    id: `recommendation-${Date.now()}`,
    createdAt: new Date().toISOString(),
    kind: candidate.kind,
    actionId: candidate.actionId || undefined,
    evidence: candidate.evidence.slice(0, 4),
    rationale: candidate.rationale,
    confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0)),
    previousValue: candidate.previousValue ?? undefined,
    proposedValue: candidate.proposedValue ?? undefined,
    safety,
    status: safety === "coach_review" ? "needs_coach_review" : "proposed",
    source: "openai",
  };
}

async function modelRecommendation(
  doc: NonNullable<Awaited<ReturnType<typeof readMemberDoc>>>,
): Promise<AiRecommendation | null> {
  if (
    !process.env.OPENAI_API_KEY ||
    !doc.onboarding?.consent?.aiPersonalisation
  )
    return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_RECOMMENDATION_MODEL || "gpt-5",
    store: false,
    input: [
      {
        role: "developer",
        content:
          "You are a bounded wellness-plan assistant. You may only reorder today's approved actions, select minimum/target/stretch versions, adjust reminder timing, or reduce numeric targets within coachLimits. Never diagnose, infer hormone levels or hormonal states, interpret body signals or clinical reports, prescribe around pain, add clinical advice, or alter the 12-week plan. Pain, body signals, hormone-related interpretations, and unusual trends must become coach_review. Return one conservative recommendation with a plain-language reason.",
      },
      { role: "user", content: JSON.stringify(compactInput(doc)) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "bounded_wellness_recommendation",
        strict: true,
        schema: recommendationSchema,
      },
    },
  });
  return guardRecommendation(
    JSON.parse(response.output_text) as Partial<AiRecommendation>,
    doc,
  );
}

export async function POST() {
  const user = await session();
  if (!user || user.role !== "member")
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!isConfigured())
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );

  try {
    const doc = await readMemberDoc(user.sub);
    if (!doc)
      return NextResponse.json(
        { error: "Member profile not found" },
        { status: 404 },
      );
    let recommendation = deterministicSafetyRecommendation(doc);
    if (!recommendation) {
      try {
        recommendation = await modelRecommendation(doc);
      } catch (error) {
        console.error(
          "[recommendations] model unavailable; using deterministic rules",
          error,
        );
      }
    }
    recommendation ??= deterministicRecommendation(doc);
    await writeMemberDoc(user.sub, {
      ...doc,
      recommendations: [...(doc.recommendations ?? []), recommendation],
    });
    return NextResponse.json({ recommendation });
  } catch (error) {
    console.error("[recommendations] generation failed", error);
    return NextResponse.json(
      {
        error:
          "Recommendations are temporarily unavailable. Your current plan is unchanged.",
      },
      { status: 503 },
    );
  }
}
