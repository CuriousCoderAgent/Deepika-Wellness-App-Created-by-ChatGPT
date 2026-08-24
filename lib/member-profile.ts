/**
 * What we know about a member, and what the plan does with it.
 *
 * The vocabulary here must match `mobile/src/profile.ts`, which owns the
 * labels and the order they are asked in. This file owns the *rules* — what
 * each answer actually changes about a plan. That split is deliberate: the
 * app should be free to reword a question without changing anyone's dose.
 *
 * Every function here is total. A member who answered nothing still gets a
 * plan; she gets the careful one. Absence is never read as permission.
 */

import type {
  AvoidCondition,
  BodyLoad,
  Exercise,
  MovementPattern,
} from "./exercise-library";
import { loadsToAvoid } from "./exercise-library";
import type { EnduranceEvent } from "./endurance";

export type AgeBand = "18-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+";
export type GoalGroup = "wellbeing" | "capacity" | "event";
/**
 * What she can tell us she has.
 *
 * Must cover every value `Exercise["equipment"]` uses, or the movements
 * needing the missing ones are unreachable by everybody — which is what
 * happened when the library gained sleds, ergs and medicine balls and this
 * list did not. A test holds the two together.
 */
export type Equipment =
  | "none"
  | "chair"
  | "wall"
  | "band"
  | "weight"
  | "household_anchor"
  | "open_space"
  | "sled"
  | "sandbag"
  | "medicine_ball"
  | "erg";
export type LifeStage =
  | "pregnant"
  | "postpartum"
  | "perimenopause"
  | "postmenopause"
  | "none_of_these"
  | "prefer_not_to_say";
export type SleepBaseline = "poor" | "broken" | "adequate" | "good";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * The event she is training for, when one of her goals is an event.
 *
 * Held separately from the goal because a goal is a direction and this is a
 * commitment with a date. Without all three of these `lib/endurance.ts` cannot
 * plan anything, so a member who chose an event goal and has not filled this
 * in is told so rather than quietly given an ordinary strength week.
 */
export interface EventTarget {
  kind: EnduranceEvent;
  /** The day of the event. */
  dateIso: string;
  /** Honest current weekly running volume, in kilometres. */
  currentWeeklyKm: number;
  /**
   * The day the block was set up.
   *
   * Stamped on save so that the block has a fixed length and a fixed week
   * number. Deriving the week from the event date alone would silently
   * re-plan week 1 every time she changed the date.
   */
  startedOn: string;
}

export interface MemberProfile {
  ageBand?: AgeBand;
  /** Goal *ids*, not labels. See `goalIdFromLabel`. */
  goals: string[];
  equipment?: Equipment[];
  lifeStage?: LifeStage;
  sleepBaseline?: SleepBaseline;
  trainingDays?: Weekday[];
  wontDo?: string;
  event?: EventTarget;
  detailConsent?: "given" | "declined";
}

/* ------------------------------------------------------------------ *
 * Goals
 * ------------------------------------------------------------------ */

/**
 * The goal vocabulary, with every label that has ever meant it.
 *
 * `legacy` exists because goals were stored as display strings for the whole
 * pilot, and four of those strings were reworded when the goal list grew.
 * Without this table those members would quietly lose their movement-pattern
 * ordering — no error, just a blander plan. Old labels are answers too.
 */
export const GOALS: {
  id: string;
  group: GoalGroup;
  patterns: MovementPattern[];
  legacy: string[];
}[] = [
  {
    id: "steady-energy",
    group: "wellbeing",
    patterns: ["squat", "balance", "mobility", "breathing"],
    legacy: ["steadier energy"],
  },
  {
    id: "sleep",
    group: "wellbeing",
    patterns: ["breathing", "mobility"],
    legacy: ["sleep more consistently"],
  },
  {
    id: "stress",
    group: "wellbeing",
    patterns: ["breathing", "mobility", "balance"],
    legacy: ["manage stress"],
  },
  {
    id: "life-stage",
    group: "wellbeing",
    patterns: ["squat", "hinge", "balance", "mobility"],
    legacy: [
      "support a life-stage change",
      "support hormonal or life-stage wellbeing",
    ],
  },
  {
    id: "stronger",
    group: "capacity",
    patterns: ["squat", "hinge", "push", "pull"],
    legacy: ["get stronger", "feel stronger"],
  },
  {
    id: "mobility",
    group: "capacity",
    patterns: ["mobility", "balance", "core"],
    legacy: ["move more easily", "improve mobility"],
  },
  {
    id: "endurance",
    group: "capacity",
    patterns: ["squat", "calf", "balance", "hinge"],
    legacy: ["build endurance", "improve endurance"],
  },
  {
    id: "bone-health",
    group: "capacity",
    /* Loading is what holds density; balance is what stops the fall. */
    patterns: ["hinge", "squat", "push", "balance"],
    legacy: ["protect bone and muscle"],
  },
  {
    id: "event-endurance",
    group: "event",
    patterns: ["run", "hinge", "calf", "core"],
    legacy: ["train for a race or ride"],
  },
  {
    id: "event-hybrid",
    group: "event",
    patterns: ["carry", "lunge", "erg", "hinge", "core"],
    legacy: ["train for a hybrid event"],
  },
];

/**
 * Resolve whatever is stored to a goal id.
 *
 * Accepts an id, a current label, or a label from before the rewording. A
 * goal we cannot resolve returns undefined rather than a guess — a free-text
 * goal from the old custom-goal box is real to the member and is still shown
 * to her coach, but it cannot order movement patterns.
 */
export function goalIdFromLabel(value: string): string | undefined {
  const needle = value.trim().toLowerCase();
  if (!needle) return undefined;
  const match = GOALS.find(
    (goal) => goal.id === needle || goal.legacy.includes(needle),
  );
  return match?.id;
}

/** Every resolvable goal id in a stored list, in the member's own order. */
export function goalIds(stored: string[]): string[] {
  const ids: string[] = [];
  for (const value of stored) {
    const id = goalIdFromLabel(value);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Goals progressed by weekly volume rather than by sets and reps.
 *
 * Not "unsupported" — differently progressed. The dose ladder moves sets and
 * reps, which cannot express a long run or a taper. See `lib/endurance.ts`.
 */
export function goalNeedsEnduranceModel(goalId: string): boolean {
  return GOALS.find((goal) => goal.id === goalId)?.group === "event";
}

/* ------------------------------------------------------------------ *
 * Age
 * ------------------------------------------------------------------ */

/**
 * Weeks of extra runway before the tier ramp opens up.
 *
 * A ceiling that never lifts is not caution, it is a member held at sit-to-
 * stand in her second year. So age delays the ramp rather than capping it: a
 * seventy-year-old spends longer at tier 1 and still arrives at tier 3.
 *
 * Unknown age gets the same delay as 60-69 — the careful branch, not the
 * average one — and she can shorten it any time by answering the question.
 */
const TIER_DELAY_WEEKS: Record<AgeBand | "unknown", number> = {
  "18-29": 0,
  "30-39": 0,
  "40-49": 0,
  "50-59": 2,
  "60-69": 4,
  "70+": 8,
  unknown: 4,
};

/**
 * Weeks of credit for what she was already doing before she arrived.
 *
 * The sign-up screen tells her this "establishes a starting point", and until
 * now it established nothing — the answer was stored, passed to the
 * generator, and never read, so a marathon runner and someone who had not
 * exercised in a decade were both started on wall push-ups. That is the
 * question being dishonest, which is worse than not asking it.
 *
 * An unknown answer is credited like the seated case, not the middle one.
 */
const ACTIVITY_CREDIT_WEEKS: Record<string, number> = {
  "mostly seated": 0,
  "some movement": 2,
  "regular exercise": 4,
};

/**
 * The hardest tier this member may be offered in a given week.
 *
 * One ramp, shifted by who she is: everyone climbs from supported movements
 * to loaded ones over a couple of months, and where she joins that ramp
 * depends on her age and on what she was already doing. It stays a ceiling
 * rather than a target — the dose ladder decides where inside it she sits,
 * and an exercise she already has history with is never swapped out from
 * under her.
 *
 * The cost of being wrong is asymmetric: too easy is a dull week, too hard is
 * an injury and a member who never comes back. So the credit for being active
 * is smaller than the delay for being older, and they are allowed to cancel.
 */
export function tierCeiling(
  week: number,
  ageBand: AgeBand | undefined,
  activityLevel?: string,
): 1 | 2 | 3 {
  const delay = TIER_DELAY_WEEKS[ageBand ?? "unknown"];
  const credit =
    ACTIVITY_CREDIT_WEEKS[(activityLevel ?? "").trim().toLowerCase()] ?? 0;
  const effective = week - delay + credit;
  if (effective <= 2) return 1;
  if (effective <= 6) return 2;
  return 3;
}

/**
 * Patterns the generator will not reach for on its own.
 *
 * Impact is the one movement class where a first session can end a member's
 * involvement. For a member over sixty, or one whose age we do not know, that
 * call belongs to a person: a coach can still assign jumping, and nothing
 * here removes an exercise she has already been given. This only stops the
 * generator from choosing it unprompted. Individual exercises carry their own
 * `avoidIf` conditions; this is the age layer on top of those.
 */
export function withheldPatternsForAge(
  ageBand: AgeBand | undefined,
): MovementPattern[] {
  if (ageBand === "70+" || ageBand === "60-69" || ageBand === undefined)
    return ["jump"];
  return [];
}

/* ------------------------------------------------------------------ *
 * Life stage
 * ------------------------------------------------------------------ */

/**
 * Conditions a life stage implies for exercise selection.
 *
 * Only pregnancy maps to a hard condition. Postpartum and the menopause
 * transition change *emphasis* — pelvic floor, bone loading — not safety,
 * and they are handled as loads and goals rather than as exclusions. Turning
 * a life stage into a blanket restriction would be its own kind of harm.
 */
export function conditionsForLifeStage(
  lifeStage: LifeStage | undefined,
): AvoidCondition[] {
  return lifeStage === "pregnant" ? ["pregnancy"] : [];
}

/** Loads a life stage rules out. */
export function loadsForLifeStage(lifeStage: LifeStage | undefined): BodyLoad[] {
  /* The floor is recovering and is exactly what gets loaded by impact and by
     maximal straining. We do not know how far along she is, so this stands
     until she changes the answer. */
  return lifeStage === "postpartum" || lifeStage === "pregnant"
    ? ["pelvic_floor"]
    : [];
}

/* ------------------------------------------------------------------ *
 * Putting it together
 * ------------------------------------------------------------------ */

/**
 * Equipment to plan against.
 *
 * The default is the home set, and it is the default precisely because the
 * gym items exist now. A member who told us nothing must never open the app
 * to a sled push.
 */
export function equipmentFor(
  profile: MemberProfile | undefined,
): Exercise["equipment"][number][] {
  const chosen = profile?.equipment ?? [];
  if (!chosen.length) return ["none", "chair", "wall"];
  /* "none" is always available — it means bodyweight, not "nothing selected",
     and every list should include it. */
  return Array.from(new Set<Exercise["equipment"][number]>(["none", ...chosen]));
}

/**
 * Everything a profile rules out, as one set of loads.
 *
 * Merges the life-stage loads with anything she wrote in "won't do", read
 * through the same free-text matcher as a movement caution. The two are
 * different questions — one is medical, one is preference — but they have
 * the same consequence for selection, and she is owed both.
 */
export function avoidLoadsFor(profile: MemberProfile | undefined): BodyLoad[] {
  const loads = new Set<BodyLoad>(loadsForLifeStage(profile?.lifeStage));
  for (const load of loadsToAvoid(profile?.wontDo)) loads.add(load);
  return Array.from(loads);
}

/**
 * How many days a week to place sessions on.
 *
 * Her chosen days when she gave them, and three otherwise — enough to make a
 * week feel like a plan, few enough that missing one is not a failed week.
 */
export function sessionDaysFor(profile: MemberProfile | undefined): number {
  const days = profile?.trainingDays?.length ?? 0;
  return days > 0 ? days : 3;
}

/**
 * Whether to start below the usual dose.
 *
 * Poor sleep is the single strongest predictor that a new plan will be
 * abandoned, and the fix is a smaller first week rather than a note about
 * sleep hygiene attached to a normal one.
 */
export function startsConservatively(
  profile: MemberProfile | undefined,
): boolean {
  return profile?.sleepBaseline === "poor";
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

/** Whole weeks from one ISO date to another. Negative when it has passed. */
function weeksBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso + "T00:00:00Z");
  const to = Date.parse(toIso + "T00:00:00Z");
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Her event block, as `lib/endurance.ts` needs it.
 *
 * The block length is fixed at set-up rather than recomputed from today, so
 * the taper stays where it was planned and week four is week four however
 * many times a plan is generated.
 */
export function eventBlockFor(
  profile: MemberProfile | undefined,
  todayIso: string,
): { event: EventProfileInput; week: number; weeksLeft: number } | undefined {
  const target = profile?.event;
  if (!target) return undefined;
  const blockWeeks = weeksBetween(target.startedOn, target.dateIso);
  if (blockWeeks <= 0) return undefined;
  return {
    event: {
      event: target.kind,
      weeksAway: blockWeeks,
      currentWeeklyKm: target.currentWeeklyKm,
      daysPerWeek: sessionDaysFor(profile),
    },
    /* 1-based, and never past the end of the block. */
    week: Math.min(
      blockWeeks,
      Math.max(1, weeksBetween(target.startedOn, todayIso) + 1),
    ),
    weeksLeft: weeksBetween(todayIso, target.dateIso),
  };
}

/** Structural mirror of `EventProfile`, kept local to avoid a cycle. */
interface EventProfileInput {
  event: EnduranceEvent;
  weeksAway: number;
  currentWeeklyKm: number;
  daysPerWeek: number;
}

/** The event goals she has chosen, if any. */
export function eventGoalIds(profile: MemberProfile | undefined): string[] {
  return goalIds(profile?.goals ?? []).filter(goalNeedsEnduranceModel);
}
