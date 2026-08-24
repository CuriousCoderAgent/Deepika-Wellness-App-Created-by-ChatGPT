/**
 * Counting what she actually did.
 *
 * One rule, applied consistently, and it is the rule that was got wrong
 * twice: **rest is recorded but is not activity.** Choosing "not today" is a
 * real and valued decision — it has its own award and it belongs in her
 * record — but a day whose only entry was a rest is not a day she showed up,
 * and counting it as one inflates every day-based figure in the app.
 *
 * This lives outside the screen file so both callers use the same definition.
 * They previously had their own, and one of them was wrong.
 */

import type { DailyAction, MemberDoc } from "./types";

/** Completed, and not a rest. The single definition of "she did something". */
export function isActive(action: DailyAction): boolean {
  return Boolean(action.completed) && action.completed !== "rest";
}

/**
 * How many distinct days in a window she did something.
 *
 * `from` is a negative day offset — the default of -6 means the last seven
 * days including today. Distinct *days*, not actions, so a busy Tuesday
 * counts once.
 */
export function activeDays(doc: MemberDoc, from = -6): number {
  return new Set(
    (doc.actions ?? [])
      .filter(
        (action) =>
          action.dayOffset >= from && action.dayOffset <= 0 && isActive(action),
      )
      .map((action) => action.dayOffset),
  ).size;
}
