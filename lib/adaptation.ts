/**
 * Deciding what to change, from what she actually did.
 *
 * This is the loop that was missing. The app has collected perceived effort
 * after every exercise, which version she completed, whether anything hurt, and
 * how she has been sleeping — and then read none of it back. A member who
 * finished everything easily for a fortnight got the same plan as one who was
 * struggling.
 *
 * **Every decision in this file is a rule, not a model.** That is deliberate.
 * Progressive overload is well understood and arithmetic is not the interesting
 * part of the problem; what a model is genuinely better at is choosing which
 * movement suits someone and explaining it in her language, which happens
 * elsewhere. Keeping the numbers here means the progression can be tested
 * exhaustively, cannot hallucinate a forty-percent jump, and still works when
 * the model is unavailable.
 *
 * The bias throughout is toward holding rather than advancing. Someone who
 * progresses a week late is mildly bored. Someone who progresses a week early
 * is injured, and stops.
 */

import type { EffortLevel } from "./types";

/** One completed exercise, flattened from whatever the client recorded. */
export interface SessionRecord {
  exerciseId: string;
  /** 1 very easy – 5 very hard. Her word, not a measurement. */
  perceivedEffort: number;
  level: EffortLevel | "rest";
  pain: boolean;
  /** YYYY-MM-DD. */
  date: string;
}

export interface DailySignal {
  date: string;
  /** 1 drained – 5 energised. */
  energy?: number;
  /** 1 poor – 5 restorative. 0 or absent means not recorded. */
  sleep?: number;
  /** 1 overwhelmed – 5 calm. */
  stress?: number;
}

export type Adjustment =
  | "progress"
  | "hold"
  | "regress"
  | "stop_and_review";

export interface ExerciseVerdict {
  exerciseId: string;
  adjustment: Adjustment;
  /** Plain language, shown to her. Never jargon, never a score. */
  reason: string;
  /** How many completed sessions this is based on. */
  basis: number;
}

/** Effort at or below this, twice running, is the signal to progress. */
const EASY = 2;
/** Effort at or above this is the signal to back off. */
const HARD = 4;
/** Nothing progresses on a single session, however easy it felt. */
const MIN_SESSIONS_TO_PROGRESS = 2;

const recent = (records: SessionRecord[], exerciseId: string) =>
  records
    .filter((r) => r.exerciseId === exerciseId && r.level !== "rest")
    .sort((a, b) => b.date.localeCompare(a.date));

/**
 * What to do about one exercise.
 *
 * Order matters: pain is checked before anything else and beats every other
 * signal, including two easy sessions in a row. "It was easy but it hurt" must
 * never resolve to progress.
 */
export function verdictFor(
  exerciseId: string,
  records: SessionRecord[],
): ExerciseVerdict {
  const history = recent(records, exerciseId);
  const basis = history.length;

  if (history.some((r) => r.pain))
    return {
      exerciseId,
      adjustment: "stop_and_review",
      reason:
        "You told us this one hurt. It is paused until someone has looked at it with you.",
      basis,
    };

  if (basis < MIN_SESSIONS_TO_PROGRESS)
    return {
      exerciseId,
      adjustment: "hold",
      reason:
        basis === 0
          ? "New this week."
          : "Staying the same while you get a feel for it.",
      basis,
    };

  const [latest, previous] = history;

  // Two hard sessions, or two where she chose the smallest version, is the app
  // being asked — politely — for less.
  const twiceHard =
    latest.perceivedEffort >= HARD && previous.perceivedEffort >= HARD;
  const twiceMinimum = latest.level === "minimum" && previous.level === "minimum";
  if (twiceHard || twiceMinimum)
    return {
      exerciseId,
      adjustment: "regress",
      reason: twiceHard
        ? "This has been feeling like hard work, so it steps back a little."
        : "Going gentler on this one for now.",
      basis,
    };

  // Easy twice AND completing the fuller version both times. Either alone is
  // not enough: easy at the minimum level only means the minimum was easy.
  const twiceEasy =
    latest.perceivedEffort <= EASY && previous.perceivedEffort <= EASY;
  const committed = [latest, previous].every(
    (r) => r.level === "target" || r.level === "stretch",
  );
  if (twiceEasy && committed)
    return {
      exerciseId,
      adjustment: "progress",
      reason: "You have made this look easy twice running. Time for a bit more.",
      basis,
    };

  return {
    exerciseId,
    adjustment: "hold",
    reason: "Holding here while it settles.",
    basis,
  };
}

export type WeekPosture = "normal" | "lighter" | "recovery";

export interface WeekAdjustment {
  posture: WeekPosture;
  reason: string;
}

/**
 * Whether the whole week should be lighter, regardless of any single exercise.
 *
 * Someone sleeping badly all week does not need her squat progressed on
 * schedule, and a plan that ignores that is the plan people quit. This looks at
 * the last seven days of her own check-ins only — never at a wearable alone,
 * because a low reading and a bad week are not the same thing.
 */
export function weekPostureFor(signals: DailySignal[]): WeekAdjustment {
  const week = [...signals]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  if (week.length < 3)
    return { posture: "normal", reason: "Not enough check-ins yet to adjust." };

  const lowSleep = week.filter((d) => (d.sleep ?? 0) > 0 && d.sleep! <= 2).length;
  const lowEnergy = week.filter((d) => (d.energy ?? 0) > 0 && d.energy! <= 2).length;
  const highStress = week.filter((d) => (d.stress ?? 0) > 0 && d.stress! <= 2).length;

  if (lowSleep >= 4 || lowEnergy >= 4)
    return {
      posture: "recovery",
      reason:
        "This week stays deliberately small while your sleep and energy catch up.",
    };
  if (lowSleep >= 2 || lowEnergy >= 2 || highStress >= 3)
    return {
      posture: "lighter",
      reason: "A slightly lighter week while things settle.",
    };
  return { posture: "normal", reason: "Steady week." };
}

/**
 * Sets and reps for one exercise, given where she is.
 *
 * Small numbers, moved slowly. The jump from 2×8 to 3×8 is a fifty percent
 * increase in volume and is the largest step this ever takes.
 */
export interface Dose {
  sets: number;
  reps: number;
  label: string;
}

const DOSE_LADDER: Dose[] = [
  { sets: 1, reps: 6, label: "1 set of 6" },
  { sets: 1, reps: 8, label: "1 set of 8" },
  { sets: 2, reps: 6, label: "2 sets of 6" },
  { sets: 2, reps: 8, label: "2 sets of 8" },
  { sets: 2, reps: 10, label: "2 sets of 10" },
  { sets: 3, reps: 8, label: "3 sets of 8" },
  { sets: 3, reps: 10, label: "3 sets of 10" },
];

export const MAX_DOSE_STEP = DOSE_LADDER.length - 1;

export function doseAt(step: number): Dose {
  const clamped = Math.max(0, Math.min(MAX_DOSE_STEP, Math.round(step)));
  return DOSE_LADDER[clamped]!;
}

/**
 * Move one step along the ladder, or along the exercise progression when the
 * ladder runs out.
 *
 * Returning `nextExercise` rather than continuing to add sets is the whole
 * point of having progressions: an endless pile of repetitions is not training,
 * and at some stage the movement itself should get harder instead.
 */
export function nextDose(
  step: number,
  adjustment: Adjustment,
  posture: WeekPosture,
): { step: number; changeExercise: "progress" | "regress" | null } {
  if (adjustment === "stop_and_review")
    return { step, changeExercise: null };
  if (adjustment === "regress")
    return { step: Math.max(0, step - 1), changeExercise: step === 0 ? "regress" : null };
  if (adjustment === "hold") return { step, changeExercise: null };

  // A recovery week suspends progression outright. Someone who is not sleeping
  // does not need more work, however easy last week felt.
  if (posture === "recovery") return { step, changeExercise: null };
  if (posture === "lighter") return { step, changeExercise: null };

  if (step >= MAX_DOSE_STEP)
    return { step: Math.floor(MAX_DOSE_STEP / 2), changeExercise: "progress" };
  return { step: step + 1, changeExercise: null };
}
