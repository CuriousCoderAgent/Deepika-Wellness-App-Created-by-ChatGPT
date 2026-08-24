/**
 * Reading the food log correctly.
 *
 * Both of these are small, and both are the kind of small that goes wrong
 * quietly, so they live in one place that a test can reach rather than inside
 * a screen file.
 */

import type { MemberDoc } from "./types";

/**
 * Meals she has not removed.
 *
 * A removed entry is tombstoned rather than dropped, because the server
 * unions these logs by id so two devices cannot erase each other's meals — a
 * row that merely vanished from the phone would return on the next sync.
 *
 * That makes filtering mandatory at every read, and forgetting one either
 * shows her a meal she deleted or keeps counting it in a total. There are
 * seven such reads across the app and the server; this is what they all call.
 */
export function liveMeals(doc: MemberDoc) {
  return (doc.foodEntries ?? []).filter((entry) => !entry.deletedAt);
}

/**
 * A day's calories, small enough for a calendar cell and still correct.
 *
 * The cell used to render `{calories}k`, so 1,650 kcal displayed as "1650k" —
 * 1.65 million. A number shown to somebody tracking their intake has to be
 * right before it is compact.
 */
export function compactKcal(calories: number): string {
  const value = Math.round(calories);
  if (value <= 0) return "";
  if (value < 1000) return String(value);
  // One decimal up to 9.9k, then whole thousands. "1.7k" fits and is true.
  //
  // Rounded arithmetically rather than with toFixed, which is unpredictable
  // at the half on binary floats: 1650 came out as "1.6k", because 1.65 is
  // stored a fraction below 1.65.
  if (value < 10_000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value / 1000)}k`;
}
