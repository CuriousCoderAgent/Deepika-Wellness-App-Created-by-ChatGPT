/**
 * What the app knows about a member, and how much of it she chose to tell.
 *
 * The plan felt generic for a simple reason: `GeneratorInput` received nine
 * fields and none of them were age, equipment, or what she was actually
 * training *for*. `Member.age` and `Member.gender` existed in the type and
 * never reached the generator at all. The library was never the constraint —
 * thirty-five movements selected from five inputs and three hundred and fifty
 * selected from five inputs are equally generic.
 *
 * ## Two tiers, and the gate between them
 *
 * **Core** is asked of everyone, because without it the plan cannot be
 * sensible: an age band and what she wants out of this. Two questions.
 *
 * **Detail** is everything else — equipment, limitations, life stage, sleep,
 * which days she actually has. It is asked only after she says yes to being
 * asked, and every field in it is skippable.
 *
 * The gate is the point. A form that opens with fourteen questions about
 * someone's body reads as a medical intake, and the honest answer to "why do
 * you need this?" has to be *so the plan fits*, offered as a choice rather
 * than a toll. Saying no must cost nothing beyond precision, and the same
 * questions stay available afterwards under You → About you, so declining now
 * is not declining forever.
 *
 * Nothing here asks for weight, body measurements, medications or diagnoses.
 * Those need a shipped feature that requires them and a consent basis to
 * match, and neither exists.
 */

/* ------------------------------------------------------------------ */
/* Core — asked of everyone                                            */
/* ------------------------------------------------------------------ */

/**
 * Age as a band, not a number.
 *
 * A decade is all the precision any of this needs: it moves the starting
 * tier, how fast progression is allowed to move, and which cautions apply by
 * default. Asking for an exact figure would collect more than is used, and
 * for a product whose members are mostly women over forty, a birthday is a
 * more loaded question than a decade.
 */
export type AgeBand = "18-29" | "30-39" | "40-49" | "50-59" | "60-69" | "70+";

export const AGE_BANDS: { band: AgeBand; label: string }[] = [
  { band: "18-29", label: "18–29" },
  { band: "30-39", label: "30s" },
  { band: "40-49", label: "40s" },
  { band: "50-59", label: "50s" },
  { band: "60-69", label: "60s" },
  { band: "70+", label: "70 or over" },
];

/**
 * What she is here for.
 *
 * Three groups, because they imply genuinely different plans rather than
 * different wording. Everyday wellbeing sizes small daily actions; building
 * capacity leans on progressive strength; training for something has a date
 * attached and changes the whole shape of a week.
 *
 * The last group is deliberately marked: those movements do not exist in the
 * library yet, and the app must not imply otherwise. See `goalIsSupported`.
 */
export type GoalGroup = "wellbeing" | "capacity" | "event";

export interface GoalOption {
  id: string;
  label: string;
  group: GoalGroup;
  /** Shown under the label, so the choice is not a guess. */
  detail: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: "steady-energy",
    label: "Steadier energy",
    group: "wellbeing",
    detail: "Fewer afternoons where everything runs out",
  },
  {
    id: "sleep",
    label: "Sleep more consistently",
    group: "wellbeing",
    detail: "A routine that protects the evening",
  },
  {
    id: "stress",
    label: "Manage stress",
    group: "wellbeing",
    detail: "Small things that reliably settle a day",
  },
  {
    id: "life-stage",
    label: "Support a life-stage change",
    group: "wellbeing",
    detail: "Perimenopause, postpartum, or another transition",
  },
  {
    id: "stronger",
    label: "Get stronger",
    group: "capacity",
    detail: "Progressive strength, starting where you are",
  },
  {
    id: "mobility",
    label: "Move more easily",
    group: "capacity",
    detail: "Stairs, floors, carrying, reaching",
  },
  {
    id: "endurance",
    label: "Build endurance",
    group: "capacity",
    detail: "Walking or running further without it costing the day",
  },
  {
    id: "bone-health",
    label: "Protect bone and muscle",
    group: "capacity",
    detail: "Loading that holds density as you age",
  },
  {
    id: "event-endurance",
    label: "Train for a race or ride",
    group: "event",
    detail: "A distance event with a date",
  },
  {
    id: "event-hybrid",
    label: "Train for a hybrid event",
    group: "event",
    detail: "Hyrox, obstacle races, and similar",
  },
];

/**
 * Goals that need the endurance model rather than the dose ladder.
 *
 * These are not "unsupported" — they are progressed differently. The dose
 * ladder in `lib/adaptation.ts` moves sets and reps, which cannot express
 * weekly running volume, a long run, or a taper. Event goals route to
 * `lib/endurance.ts` instead.
 */
export function goalNeedsEnduranceModel(goalId: string): boolean {
  return GOAL_OPTIONS.find((option) => option.id === goalId)?.group === "event";
}

/* ------------------------------------------------------------------ */
/* Detail — asked only after she agrees to be asked                    */
/* ------------------------------------------------------------------ */

/** What she can train with. Drives which movements are even offerable. */
export type Equipment = "none" | "chair" | "wall" | "band" | "weight";

export const EQUIPMENT_OPTIONS: { id: Equipment; label: string }[] = [
  { id: "chair", label: "A sturdy chair" },
  { id: "wall", label: "Clear wall space" },
  { id: "band", label: "A resistance band" },
  { id: "weight", label: "Dumbbells or weights" },
];

/**
 * Where she is, if she wants to say.
 *
 * Changes which education is relevant and which cautions apply by default —
 * never a diagnosis, and never surfaced as one. Skippable, and the reason it
 * is asked is stated where it is asked.
 */
export type LifeStage =
  | "pregnant"
  | "postpartum"
  | "perimenopause"
  | "postmenopause"
  | "none_of_these"
  | "prefer_not_to_say";

export const LIFE_STAGES: { id: LifeStage; label: string }[] = [
  { id: "pregnant", label: "Pregnant" },
  { id: "postpartum", label: "Postpartum — within a year" },
  { id: "perimenopause", label: "Perimenopause" },
  { id: "postmenopause", label: "Post-menopause" },
  { id: "none_of_these", label: "None of these" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
];

/** How she has been sleeping, before any check-in data exists. */
export type SleepBaseline = "poor" | "broken" | "adequate" | "good";

export const SLEEP_BASELINES: { id: SleepBaseline; label: string }[] = [
  { id: "poor", label: "Badly, most nights" },
  { id: "broken", label: "Broken — I wake often" },
  { id: "adequate", label: "Well enough" },
  { id: "good", label: "Well" },
];

/**
 * Which days are realistic.
 *
 * A single "available minutes" figure assumed every day was the same, which
 * is exactly wrong for the people this is built for. Sunday and Wednesday are
 * not the same day.
 */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

/**
 * Everything the app has been told, and how much of it she volunteered.
 *
 * Every detail field is optional in the type as well as in the form, so code
 * reading it has to handle absence rather than assuming a default that was
 * never stated.
 */
export interface MemberProfile {
  /* Core */
  ageBand?: AgeBand;
  /** Goal ids from GOAL_OPTIONS, in her order of priority. */
  goals: string[];

  /* Detail */
  equipment?: Equipment[];
  lifeStage?: LifeStage;
  sleepBaseline?: SleepBaseline;
  /** Days she realistically has. Absent means every day is the same. */
  trainingDays?: Weekday[];
  /** Free text. Excluded outright rather than discouraged. */
  wontDo?: string;

  /**
   * Whether she was asked for detail, and what she said.
   *
   * `declined` is a real answer and is recorded as one, so the app never
   * re-asks in a way that reads as nagging, and About you can say "you can
   * add this whenever you like" rather than pretending it was never offered.
   */
  detailConsent?: "given" | "declined";
}

/**
 * How much of the picture the app has, for telling her honestly.
 *
 * Shown in About you as a reason to add more, never as a score or a nag.
 * "Four of nine" is a fact; a progress ring with a red segment would be a
 * judgement about how forthcoming she has been.
 */
export function profileCompleteness(profile: MemberProfile): {
  known: number;
  total: number;
} {
  const fields = [
    profile.ageBand,
    profile.goals.length ? profile.goals : undefined,
    profile.equipment?.length ? profile.equipment : undefined,
    profile.lifeStage,
    profile.sleepBaseline,
    profile.trainingDays?.length ? profile.trainingDays : undefined,
    profile.wontDo?.trim() ? profile.wontDo : undefined,
  ];
  return {
    known: fields.filter((value) => value !== undefined).length,
    total: fields.length,
  };
}
