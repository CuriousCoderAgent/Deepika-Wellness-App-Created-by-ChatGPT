/**
 * What a member's last four weeks look like, to herself and to her circle.
 *
 * This is the shape the social feature is built on, and the shape is the
 * argument. The published research on social features in activity apps is
 * consistent on two points: the benefit flows through **social support**, and
 * **comparison backfires for beginners** — being ranked last in week one is
 * where most beginners stop. Members here are largely beginners, so a ranked
 * ladder would push out the people the product exists for.
 *
 * So what one member sees about another is a *pattern*, not a position: a strip
 * of the last twenty-eight days showing which ones she showed up on. Two people
 * looking at each other's strips can both feel encouraged, which is not true of
 * two people looking at a leaderboard.
 *
 * Three rules follow from that and are worth keeping:
 *
 * - **No zero state is rendered as failure.** A day with nothing is simply
 *   lighter. There is no red, no cross, no gap count.
 * - **A rest day counts as showing up**, exactly as it does everywhere else in
 *   the product.
 * - **The number shown is days present, never days missed.** "19 of the last 28"
 *   and "9 missed" are the same fact and not the same sentence.
 */

const DAY_MS = 86_400_000;

/** How much happened on one day. Never a score, and never negative. */
export type DayLevel = 0 | 1 | 2 | 3;

export interface ConsistencyDay {
  date: string;
  level: DayLevel;
}

export interface ConsistencySummary {
  /** Oldest first, so it reads left to right. */
  days: ConsistencyDay[];
  /** Days with anything at all, out of the window. */
  activeDays: number;
  windowDays: number;
  /**
   * The longest run of consecutive active days in the window.
   *
   * Deliberately *not* called a streak and deliberately not live: a live streak
   * creates something to lose, and the loss is what makes people stop opening
   * the app. This is a fact about a past month, which is safe to be proud of.
   */
  longestRun: number;
}

export interface ConsistencyInput {
  /** Dates on which any action was completed, including rest. */
  activeDates: string[];
  /** Dates with a movement session completed, which counts for more. */
  movementDates?: string[];
  /** Dates with a check-in, meal or water logged. Counts, but lightly. */
  loggedDates?: string[];
}

function isoDay(base: Date, offset: number): string {
  return new Date(base.getTime() + offset * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Build the strip.
 *
 * Levels are ordered by effort, not by amount: logging something is a level,
 * completing an action is a level above it, and a movement session is the top.
 * Someone who logged a meal on a hard day still sees a mark for it, which is
 * the entire point of the lower levels existing.
 */
export function consistencyFor(
  input: ConsistencyInput,
  today = new Date(),
  windowDays = 28,
): ConsistencySummary {
  const active = new Set(input.activeDates);
  const movement = new Set(input.movementDates ?? []);
  const logged = new Set(input.loggedDates ?? []);

  const days: ConsistencyDay[] = [];
  for (let offset = -(windowDays - 1); offset <= 0; offset++) {
    const date = isoDay(today, offset);
    const level: DayLevel = movement.has(date)
      ? 3
      : active.has(date)
        ? 2
        : logged.has(date)
          ? 1
          : 0;
    days.push({ date, level });
  }

  let longestRun = 0;
  let run = 0;
  for (const day of days) {
    run = day.level > 0 ? run + 1 : 0;
    if (run > longestRun) longestRun = run;
  }

  return {
    days,
    activeDays: days.filter((day) => day.level > 0).length,
    windowDays,
    longestRun,
  };
}

/**
 * One sentence about a strip, for the member it belongs to.
 *
 * Never mentions what is missing. Someone with four active days out of
 * twenty-eight is told about the four.
 */
export function consistencySentence(summary: ConsistencySummary): string {
  const { activeDays, windowDays, longestRun } = summary;
  if (activeDays === 0) return "Your first day is whenever you decide it is.";
  if (activeDays === 1) return "One day in. That is how every month starts.";
  if (longestRun >= 5)
    return `${activeDays} days in the last ${windowDays}, including a run of ${longestRun}.`;
  return `${activeDays} days in the last ${windowDays}.`;
}

/**
 * The circle's shared number.
 *
 * Cooperative rather than competitive: everyone's days add, nobody's subtract,
 * and a quiet week from one person dilutes the total slightly rather than
 * putting her at the bottom of anything. This is the number the group is
 * invited to move together.
 */
export function circleTotal(
  summaries: ConsistencySummary[],
): { activeDays: number; possibleDays: number; people: number } {
  return {
    activeDays: summaries.reduce((sum, s) => sum + s.activeDays, 0),
    possibleDays: summaries.reduce((sum, s) => sum + s.windowDays, 0),
    people: summaries.length,
  };
}
