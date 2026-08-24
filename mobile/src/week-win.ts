/**
 * Finding something real to say about a week that has finished.
 *
 * The Plan screen showed "Notable win" over the sentence "7 planned actions
 * completed" — a count, under a heading promising something meaningful. That
 * is hollow praise, and hollow praise is expensive: the first time someone
 * notices the app is calling arithmetic an achievement, everything else it
 * says gets discounted too.
 *
 * So this looks for an actual event, in order of how much it would mean to
 * the person it happened to, and returns null when there was not one. A week
 * with nothing notable in it is a normal week, and saying so plainly is
 * better than manufacturing something.
 *
 * ## What counts, and why in this order
 *
 * A comeback first, because starting again after a gap is the hardest thing
 * this product asks of anyone and the thing most likely to be dismissed by
 * the person who did it. Then a complete day, then a session that was hard
 * and finished anyway — effort she can feel but a count cannot show. First
 * time with a movement last, because it is real but small.
 *
 * Nothing here counts rest as an achievement. Rest is valued elsewhere and
 * has its own award; framing it as a win of the week would make the word
 * meaningless.
 */

import { isActive } from "./activity";
import type { DailyAction, MemberDoc, WorkoutLog } from "./types";

export interface WeekWin {
  /** One line, specific, and true. Never a count dressed as an achievement. */
  text: string;
  /** Which rule fired. Useful in tests and when tuning the order. */
  kind: "comeback" | "whole_day" | "hard_session" | "first_movement";
}

const EFFORT_WORDS = ["", "very easy", "easy", "steady", "hard", "very hard"];

/** A gap this long before showing up again is worth naming. */
const GAP_DAYS = 3;

function activeDayOffsets(actions: DailyAction[]): number[] {
  return [
    ...new Set(actions.filter(isActive).map((action) => action.dayOffset)),
  ].sort((a, b) => a - b);
}

/**
 * The one thing worth saying about this week, if there is one.
 *
 * `weekActions` are the actions inside the week being described;
 * `allActions` is everything, because a comeback is only visible against what
 * came before the week started.
 */
export function findWeekWin(
  weekActions: DailyAction[],
  allActions: DailyAction[],
  workoutLogs: WorkoutLog[] = [],
): WeekWin | null {
  const activeDays = activeDayOffsets(weekActions);
  if (!activeDays.length) return null;

  /* 1. She started again. ------------------------------------------- */
  const priorActive = activeDayOffsets(allActions).filter(
    (day) => day < activeDays[0]!,
  );
  const lastActiveBefore = priorActive.at(-1);
  if (
    lastActiveBefore !== undefined &&
    activeDays[0]! - lastActiveBefore > GAP_DAYS
  ) {
    const gap = activeDays[0]! - lastActiveBefore;
    return {
      kind: "comeback",
      text: `You came back after ${gap} days away. Starting again is the hardest part, and you did it.`,
    };
  }

  /* 2. A day where every part of the plan got something. ------------- */
  const domainsByDay = new Map<number, Set<string>>();
  for (const action of weekActions.filter(isActive)) {
    if (!domainsByDay.has(action.dayOffset))
      domainsByDay.set(action.dayOffset, new Set());
    domainsByDay.get(action.dayOffset)!.add(action.domain);
  }
  const wholeDays = [...domainsByDay.values()].filter(
    (domains) => domains.size >= 5,
  ).length;
  if (wholeDays)
    return {
      kind: "whole_day",
      text:
        wholeDays === 1
          ? "One day this week you did something in every part of the plan — movement, walking, food, rest and mind."
          : `${wholeDays} days this week you did something in every part of the plan.`,
    };

  /* 3. A session that was hard, and finished anyway. ----------------- */
  const weekActionIds = new Set(weekActions.map((action) => action.id));
  const hard = workoutLogs.find((log) => {
    const raw = log as unknown as Record<string, unknown>;
    const effort = Number(raw.perceivedEffort ?? 0);
    const level = String(raw.level ?? "");
    return (
      weekActionIds.has(String(raw.actionId ?? "")) &&
      effort >= 4 &&
      (level === "target" || level === "stretch")
    );
  });
  if (hard) {
    const raw = hard as unknown as Record<string, unknown>;
    const title =
      weekActions.find((action) => action.id === String(raw.actionId ?? ""))
        ?.title ?? "a session";
    const effort = EFFORT_WORDS[Number(raw.perceivedEffort ?? 0)] ?? "hard";
    return {
      kind: "hard_session",
      // Names what she did and how it felt. A count cannot show effort.
      text: `You finished ${title} on a day it felt ${effort}, and did the full version anyway.`,
    };
  }

  /* 4. Something she had not done before. ---------------------------- */
  const earlierTitles = new Set(
    allActions
      .filter(
        (action) =>
          isActive(action) &&
          action.dayOffset < activeDays[0]! &&
          action.domain === "movement",
      )
      .map((action) => action.title),
  );
  const firstTime = weekActions.find(
    (action) =>
      isActive(action) &&
      action.domain === "movement" &&
      !earlierTitles.has(action.title),
  );
  if (firstTime && earlierTitles.size)
    return {
      kind: "first_movement",
      text: `This was the week you did ${firstTime.title} for the first time.`,
    };

  return null;
}
