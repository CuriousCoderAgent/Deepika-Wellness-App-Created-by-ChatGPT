/**
 * Building a member's day.
 *
 * The app has always shown five domains — movement, walking, nutrition,
 * recovery, mindset — and until now they were either published by a coach or
 * filled with a placeholder check-in that asked her to think about the domain
 * rather than do anything in it. This is what fills them when there is no coach,
 * which is now the default rather than the exception.
 *
 * Four things she was asked at sign-up finally decide something here:
 *
 * - **available minutes** sizes the movement session. Fifteen minutes and
 *   forty-five minutes produced an identical day before this existed, which
 *   made the question dishonest.
 * - **goals** order the patterns, so someone who chose "feel stronger" gets a
 *   different session from someone who chose "manage stress".
 * - **the caution she typed** removes movements. It had never been read.
 * - **the readiness answers** remove more, or hold movement entirely.
 *
 * Two rules hold the whole thing together:
 *
 * 1. **A coach-authored action is never replaced.** If someone is paying for a
 *    coach, the coach decides, and generation fills only what she left empty.
 * 2. **Nothing is invented.** Every movement comes from `exercise-library.ts`.
 *    Selection and ordering happen here; the movements themselves were written
 *    by hand and are being reviewed by a professional.
 */

import {
  eligibleExercises,
  EXERCISE_BY_ID,
  loadsToAvoid,
  type AvoidCondition,
  type BodyLoad,
  type Exercise,
  type MovementPattern,
} from "./exercise-library";
import {
  doseAt,
  weekPostureFor,
  type DailySignal,
  type WeekPosture,
} from "./adaptation";

export interface GeneratorInput {
  memberId: string;
  week: number;
  goals: string[];
  availableMinutes: number;
  activityLevel?: string;
  movementCaution?: string;
  readiness?: {
    outcome: "clear" | "modified" | "consult_first";
    conditions: AvoidCondition[];
    avoidLoads: BodyLoad[];
  };
  /** Per-exercise position on the dose ladder, carried between days. */
  doseSteps?: Record<string, number>;
  /** Exercises paused after a pain report. Never re-offered automatically. */
  pausedExerciseIds?: string[];
  signals?: DailySignal[];
  /** Domains a coach has already filled today. Generation leaves these alone. */
  coachAuthoredDomains?: string[];
}

export interface GeneratedExercise {
  exerciseId: string;
  name: string;
  sets: string;
  cue: string;
  frames: string[];
  minutes: number;
}

export interface GeneratedPlan {
  /** Empty when readiness holds movement. */
  session: GeneratedExercise[];
  posture: WeekPosture;
  /** Shown as "why this today". One sentence, her language. */
  rationale: string;
  /** Set when movement is held rather than generated. */
  movementHeld?: { title: string; body: string };
  /** Domains this run filled, so callers know what not to overwrite. */
  filledDomains: string[];
}

/**
 * How the movement session is ordered, per goal.
 *
 * Not a scoring function. Someone who says she wants to feel stronger should
 * see strength first and recognise her own answer in her plan; a weighted blend
 * of every goal produces a session that looks the same for everyone, which is
 * the problem this is meant to fix.
 */
const GOAL_PATTERNS: Record<string, MovementPattern[]> = {
  "feel stronger": ["squat", "hinge", "push", "pull"],
  "improve mobility": ["mobility", "balance", "core"],
  "manage stress": ["breathing", "mobility", "balance"],
  "sleep more consistently": ["breathing", "mobility"],
  "steadier energy": ["squat", "balance", "mobility", "breathing"],
  "improve endurance": ["squat", "calf", "balance", "hinge"],
  "support hormonal or life-stage wellbeing": ["squat", "hinge", "balance", "mobility"],
};

/** Every session touches these, whatever the goal, so nothing is neglected. */
const BASE_PATTERNS: MovementPattern[] = [
  "squat",
  "hinge",
  "push",
  "pull",
  "core",
  "balance",
  "mobility",
];

function patternOrder(goals: string[]): MovementPattern[] {
  const ordered: MovementPattern[] = [];
  for (const goal of goals) {
    for (const pattern of GOAL_PATTERNS[goal.trim().toLowerCase()] ?? []) {
      if (!ordered.includes(pattern)) ordered.push(pattern);
    }
  }
  for (const pattern of BASE_PATTERNS) {
    if (!ordered.includes(pattern)) ordered.push(pattern);
  }
  return ordered;
}

/**
 * The time budget for movement.
 *
 * Her stated minutes cover the whole day's plan, and the other four domains
 * need a little of it — a pulse check-in, logging a meal. Movement gets the
 * rest, with a floor so that even ten stated minutes produces a real session
 * rather than one exercise.
 */
export function movementBudget(availableMinutes: number): number {
  const stated = Number.isFinite(availableMinutes) ? availableMinutes : 15;
  return Math.max(6, Math.min(60, stated) - 4);
}

/**
 * A lighter week trims the session rather than the difficulty of each move.
 *
 * The count matters more than the minutes here. These movements are two to four
 * minutes each, so a time budget alone stops binding well before a session gets
 * long — a member on a recovery week would have received exactly the same six
 * exercises as everyone else. Fewer things to do is what actually makes a week
 * lighter.
 */
function budgetForPosture(budget: number, posture: WeekPosture): number {
  if (posture === "recovery") return Math.max(5, Math.round(budget * 0.5));
  if (posture === "lighter") return Math.max(6, Math.round(budget * 0.75));
  return budget;
}

const MAX_ITEMS: Record<WeekPosture, number> = {
  normal: 6,
  lighter: 4,
  recovery: 3,
};

/**
 * Choose the session.
 *
 * One exercise per pattern in priority order, taking whatever fits the time
 * left. Spreading across patterns rather than stacking three squat variations
 * is what makes a short session worth doing at all.
 */
export function selectSession(
  input: GeneratorInput,
  posture: WeekPosture,
): GeneratedExercise[] {
  const paused = new Set(input.pausedExerciseIds ?? []);
  const available = eligibleExercises({
    avoidLoads: [
      ...loadsToAvoid(input.movementCaution),
      ...(input.readiness?.avoidLoads ?? []),
    ],
    conditions: input.readiness?.conditions ?? [],
    // A band and free weights are not assumed. A chair and a wall are.
    equipment: ["none", "chair", "wall"],
    maxTier: input.week <= 2 ? 1 : input.week <= 6 ? 2 : 3,
  }).filter((exercise) => !paused.has(exercise.id));

  let remaining = budgetForPosture(
    movementBudget(input.availableMinutes),
    posture,
  );
  const session: GeneratedExercise[] = [];
  const used = new Set<string>();

  const maxItems = MAX_ITEMS[posture];
  for (const pattern of patternOrder(input.goals)) {
    if (remaining <= 0 || session.length >= maxItems) break;
    const candidate = pickForPattern(available, pattern, used, input.doseSteps);
    if (!candidate || candidate.minutes > remaining) continue;
    used.add(candidate.id);
    remaining -= candidate.minutes;
    session.push(describe(candidate, input.doseSteps?.[candidate.id] ?? 0));
  }

  // A very restricted member can end up with nothing above, so fall back to
  // anything eligible rather than showing her an empty day.
  if (!session.length && available.length) {
    const fallback = available.sort((a, b) => a.tier - b.tier)[0]!;
    session.push(describe(fallback, input.doseSteps?.[fallback.id] ?? 0));
  }
  return session;
}

/**
 * The right exercise for a pattern, given where she is on it.
 *
 * Where she has history, that exercise is kept — progression happens by dose
 * and by the explicit `progressesTo` link, never by silently swapping her onto
 * a different movement because it sorted higher today.
 */
function pickForPattern(
  available: Exercise[],
  pattern: MovementPattern,
  used: Set<string>,
  doseSteps: Record<string, number> | undefined,
): Exercise | null {
  const inPattern = available.filter(
    (e) => e.pattern === pattern && !used.has(e.id),
  );
  if (!inPattern.length) return null;
  const known = inPattern.filter((e) => (doseSteps?.[e.id] ?? 0) > 0);
  if (known.length)
    return known.sort(
      (a, b) => (doseSteps?.[b.id] ?? 0) - (doseSteps?.[a.id] ?? 0),
    )[0]!;
  return inPattern.sort((a, b) => a.tier - b.tier)[0]!;
}

function describe(exercise: Exercise, step: number): GeneratedExercise {
  const dose = doseAt(step);
  const timed =
    exercise.pattern === "breathing" || exercise.pattern === "mobility";
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    sets: timed ? `${exercise.minutes} minutes` : dose.label,
    cue: exercise.cue,
    frames: [...exercise.frames],
    minutes: exercise.minutes,
  };
}

/**
 * Build today.
 *
 * Pure: everything it needs arrives as input, so the whole thing can be tested
 * without a database, a model, or a member.
 */
export function generatePlan(input: GeneratorInput): GeneratedPlan {
  const { posture, reason } = weekPostureFor(input.signals ?? []);
  const coachOwned = new Set(input.coachAuthoredDomains ?? []);

  if (input.readiness?.outcome === "consult_first")
    return {
      session: [],
      posture,
      rationale: reason,
      movementHeld: {
        title: "Movement is on hold for now",
        body:
          "Based on your answers before you started, it is worth speaking to a doctor before beginning a movement plan. Everything else here is yours to use — food, water, your daily check-in and reading. Update your answers whenever you have had that conversation.",
      },
      filledDomains: [],
    };

  const session = coachOwned.has("movement") ? [] : selectSession(input, posture);
  const filled = session.length ? ["movement"] : [];

  return {
    session,
    posture,
    rationale:
      posture === "normal"
        ? sessionRationale(session, input)
        : reason,
    filledDomains: filled,
  };
}

/** One honest sentence about why today looks like this. */
function sessionRationale(
  session: GeneratedExercise[],
  input: GeneratorInput,
): string {
  if (!session.length) return "Your coach has set today's plan.";
  const minutes = session.reduce((sum, e) => sum + e.minutes, 0);
  const caution = input.movementCaution?.trim();
  const patterns = new Set(
    session
      .map((e) => EXERCISE_BY_ID.get(e.exerciseId)?.pattern)
      .filter(Boolean),
  );
  const shape =
    patterns.size >= 4
      ? "a spread across your whole body"
      : patterns.size >= 2
        ? "a couple of different patterns"
        : "one focused movement";
  return caution
    ? `About ${minutes} minutes, ${shape}, working around what you told us about your ${caution.toLowerCase()}.`
    : `About ${minutes} minutes, ${shape}, sized to the time you said you have.`;
}
