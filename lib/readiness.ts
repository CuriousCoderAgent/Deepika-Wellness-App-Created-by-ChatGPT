/**
 * Asking, before anyone is told to exercise, whether they should.
 *
 * With a coach in the loop this was Deepika's job. In a coach-optional product
 * nobody is checking, and the software is about to hand a squat plan to whoever
 * downloads it — including someone with chest pain on exertion, someone eight
 * weeks post-surgery, and someone who faints when she stands up quickly.
 *
 * This is triage, not diagnosis. It does not interpret anything, name a
 * condition, or decide whether someone is ill. It asks a short set of yes/no
 * questions drawn from the standard pre-exercise readiness screens, and sorts
 * the answers into three outcomes: carry on, carry on with these movements
 * removed, or please speak to a doctor before starting. That distinction is
 * what keeps it well clear of the clinical line the product holds elsewhere.
 *
 * Two deliberate choices:
 *
 * - **"Not sure" is treated as "yes".** Someone who does not know whether her
 *   blood pressure is controlled is exactly the person who should be asked to
 *   check, and the cost of being wrong in that direction is a conversation
 *   rather than an injury.
 * - **A blocking answer does not lock her out of the app.** She keeps her food
 *   log, water, habits, check-ins and reading. Only the movement plan waits.
 *   Locking someone out of everything teaches her to lie to the screen.
 */

import type { AvoidCondition, BodyLoad } from "./exercise-library";

export type ReadinessAnswer = "yes" | "no" | "unsure";

export type ReadinessOutcome =
  /** Nothing flagged. The movement plan runs normally. */
  | "clear"
  /** Plan runs, with specific movements removed. */
  | "modified"
  /** Movement plan is held until she has spoken to a doctor. */
  | "consult_first";

export interface ReadinessQuestion {
  id: string;
  /** Asked in her words, in the second person, with no medical jargon. */
  prompt: string;
  /** Shown underneath when the question could be read too broadly. */
  hint?: string;
  /**
   * What a "yes" means for the plan. `consult_first` holds the movement plan;
   * `modified` removes movements; `note` is recorded and shown to a coach but
   * changes nothing on its own.
   */
  effect: "consult_first" | "modified" | "note";
  /** Movements to remove when the answer is yes. */
  conditions?: AvoidCondition[];
  avoidLoads?: BodyLoad[];
}

/**
 * The screen itself.
 *
 * Seven questions. Long enough to catch what matters, short enough that
 * somebody actually reads them rather than tapping "no" seven times.
 */
export const READINESS_QUESTIONS: ReadinessQuestion[] = [
  {
    id: "chest-pain",
    prompt:
      "Do you ever get chest pain, pressure or unusual breathlessness when you exert yourself?",
    hint: "Climbing stairs, carrying shopping, walking quickly.",
    effect: "consult_first",
  },
  {
    id: "fainting",
    prompt: "Do you lose your balance from dizziness, or ever faint?",
    hint: "Feeling briefly light-headed when you stand up is common and is not what this means.",
    effect: "modified",
    conditions: ["dizziness"],
    avoidLoads: ["balance"],
  },
  {
    id: "heart-condition",
    prompt:
      "Has a doctor ever told you that you have a heart condition, or that you should only exercise under medical supervision?",
    effect: "consult_first",
  },
  {
    id: "blood-pressure",
    prompt: "Do you have high blood pressure that is not currently controlled?",
    hint: "If it is managed and your doctor is happy, answer no.",
    effect: "modified",
    conditions: ["high_blood_pressure"],
  },
  {
    id: "recent-surgery",
    prompt:
      "Have you had surgery, a fracture or a serious injury in the last three months?",
    effect: "consult_first",
    conditions: ["recent_surgery"],
  },
  {
    id: "pregnancy",
    prompt: "Are you pregnant, or have you given birth in the last six months?",
    hint: "Exercise is usually good in both cases — this just changes which movements you are offered.",
    effect: "modified",
    conditions: ["pregnancy"],
    avoidLoads: ["pelvic_floor"],
  },
  {
    id: "bone-health",
    prompt: "Have you been told you have osteoporosis or thinning bones?",
    effect: "modified",
    conditions: ["osteoporosis"],
  },
];

export interface ReadinessState {
  /** Answers by question id. Absent means not yet asked. */
  answers: Record<string, ReadinessAnswer>;
  completedAt?: string;
  /** Recomputed on every save; never trusted from the client. */
  outcome: ReadinessOutcome;
  conditions: AvoidCondition[];
  avoidLoads: BodyLoad[];
  /**
   * She has read the "please speak to a doctor" message and asked to continue
   * anyway. Movement stays held; this only records that she was told.
   */
  acknowledgedAt?: string;
}

/** "Not sure" counts as yes. See the note at the top of this file. */
function flagged(answer: ReadinessAnswer | undefined): boolean {
  return answer === "yes" || answer === "unsure";
}

/**
 * Turn answers into an outcome.
 *
 * Pure, so it can be tested exhaustively and recomputed server-side rather
 * than trusting whatever the app sends.
 */
export function evaluateReadiness(
  answers: Record<string, ReadinessAnswer>,
): Omit<ReadinessState, "answers" | "completedAt" | "acknowledgedAt"> {
  const conditions = new Set<AvoidCondition>();
  const avoidLoads = new Set<BodyLoad>();
  let consult = false;

  for (const question of READINESS_QUESTIONS) {
    if (!flagged(answers[question.id])) continue;
    question.conditions?.forEach((condition) => conditions.add(condition));
    question.avoidLoads?.forEach((load) => avoidLoads.add(load));
    if (question.effect === "consult_first") consult = true;
  }

  return {
    outcome: consult
      ? "consult_first"
      : conditions.size || avoidLoads.size
        ? "modified"
        : "clear",
    conditions: [...conditions],
    avoidLoads: [...avoidLoads],
  };
}

export function readinessIsComplete(
  answers: Record<string, ReadinessAnswer>,
): boolean {
  return READINESS_QUESTIONS.every((question) => answers[question.id]);
}

/**
 * What she is told, in each case.
 *
 * Written to be read by someone who is about to be told she cannot start yet,
 * which is a disappointing thing to hear. It says what happens next and does
 * not imply anything is wrong with her.
 */
export function readinessMessage(outcome: ReadinessOutcome): {
  title: string;
  body: string;
} {
  if (outcome === "consult_first")
    return {
      title: "Worth a word with your doctor first",
      body:
        "Based on your answers, it is worth checking with a doctor before starting a movement plan. This is the standard advice for what you have told us, and it is not a judgement about your health.\n\nEverything else in Bharosa is open — your food log, water, daily check-ins and reading. Once you have spoken to someone, come back to this screen and update your answers.",
    };
  if (outcome === "modified")
    return {
      title: "Your plan is adjusted",
      body:
        "Thank you. Some movements will be left out of your plan based on what you have told us, and everything else works normally. You can change these answers at any time in Profile.",
    };
  return {
    title: "You are ready to start",
    body:
      "Nothing here needs adjusting. If anything changes — an injury, a new diagnosis, a pregnancy — update these answers and your plan will follow.",
  };
}
