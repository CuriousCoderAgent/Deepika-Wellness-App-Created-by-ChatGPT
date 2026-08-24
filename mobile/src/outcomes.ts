/**
 * What actually happened to an action she did not complete.
 *
 * Everything not-done was recorded as `completed: "rest"` — one value for a
 * deliberate recovery decision, an afternoon that got away from her, and a day
 * she felt unwell. Three different things, and the app treated them as the
 * same one, which had two consequences worth naming:
 *
 * - The **"Rest counts" award** congratulated someone on a considered recovery
 *   choice when she had simply run out of time. Telling a person she made a
 *   wise decision she did not make is a small lie, and this product's whole
 *   claim is that it reads her honestly.
 * - The **plan learned nothing.** "No time" three days running should size the
 *   week differently from "unwell" three days running, and neither is
 *   "rested". The signal existed and was being flattened on the way in.
 *
 * The storage shape is deliberately unchanged: `completed` stays
 * `"rest"` so every existing reader — adaptation, history, the server merge —
 * behaves as before, and `skipReason` sits alongside it. Widening the
 * `completed` union would have touched the dose ladder, and changing how
 * exercise progression reads its input to improve a label is the wrong trade.
 *
 * ## On asking at all
 *
 * There is a real tension here. A product that never says "missed" or "behind"
 * should not then demand an excuse. So this is not a "why didn't you?" prompt:
 * the three options are offered as equally valid descriptions of a day, in her
 * words, and nothing anywhere ranks them or treats one as better. She can also
 * ignore the question entirely — `undefined` is a legitimate outcome and is
 * exactly what an older build records.
 */

/** Why an action was not completed. Absent means she did not say. */
export type SkipReason = "rested" | "no_time" | "unwell";

export interface SkipOption {
  reason: SkipReason;
  /** What the button says. Neutral, and never a justification. */
  label: string;
  /** The one-line confirmation. Never praise, never disappointment. */
  note: string;
}

/**
 * Offered in this order on purpose.
 *
 * Rest first, because it is the choice the product most wants to make easy —
 * a member who feels able to *decide* to rest is doing better than one who
 * feels she failed. The other two follow as plain descriptions.
 */
export const SKIP_OPTIONS: SkipOption[] = [
  {
    reason: "rested",
    label: "Resting today",
    note: "Recorded as rest. Choosing it counts.",
  },
  {
    reason: "no_time",
    label: "No time today",
    note: "Recorded. Tomorrow starts fresh.",
  },
  {
    reason: "unwell",
    label: "Not feeling well",
    note: "Recorded. Nothing is expected of you today.",
  },
];

/**
 * Whether this counts as a deliberate rest.
 *
 * Only a stated rest does. An unstated skip does not, which is why the older
 * records that carry no reason are excluded: a build that never asked cannot
 * be read as though she answered.
 */
export function isDeliberateRest(reason: SkipReason | undefined): boolean {
  return reason === "rested";
}

/** How a skipped day reads back in her record. Never a reprimand. */
export function describeSkip(reason: SkipReason | undefined): string {
  switch (reason) {
    case "rested":
      return "Rest — which counts";
    case "no_time":
      return "No time that day";
    case "unwell":
      return "Not feeling well";
    default:
      // Recorded before the app asked, or she chose not to say. Both are the
      // same to a reader, and neither is a failure.
      return "Not done that day";
  }
}
