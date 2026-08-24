/**
 * Everything she has logged, in one list.
 *
 * The app records four different kinds of thing about a day — what she ate,
 * how she felt, what she trained, and anything she wanted to remember — and
 * until now each lived on a different screen with a different shape. Meals
 * were a tab; check-ins were a card on Today; workouts were a side effect of
 * completing a session; notes did not exist. There was no way to answer
 * "what did I log yesterday" without visiting three places.
 *
 * This flattens them into one feed. It is display-only: nothing here writes,
 * and every kind keeps its own storage and its own rules. The feed exists so
 * the Log tab can show a single "Recent" list, and so that list stays correct
 * when a new kind is added rather than needing a fourth special case.
 *
 * Deleted rows are excluded here rather than by each caller. Food entries use
 * tombstones because the server merges those logs by union — see the note on
 * `deletedAt` in `types.ts` — and a feed that ignored them would resurrect
 * every meal she had removed.
 */

import type { MemberDoc, FoodEntry, PulseEntry, WorkoutLog } from "./types";

export type LogKind = "meal" | "checkin" | "workout" | "note";

export interface LogItem {
  id: string;
  kind: LogKind;
  /** "Breakfast", "Evening check-in", "Strength session". */
  title: string;
  /** The one line under it: "410 kcal · 24g protein". */
  detail: string;
  /** Sortable, and what "today"/"yesterday" is derived from. */
  at: string;
  /** Present where the entry belongs to a calendar day rather than a moment. */
  loggedDate?: string;
}

/** A note she wrote, which belongs to no other kind. */
export interface MemberNote {
  id: string;
  memberId: string;
  loggedDate: string;
  body: string;
  createdAt: string;
  /** Tombstone, for the same reason food entries have one. */
  deletedAt?: string;
}

/**
 * How a check-in reads back to her.
 *
 * Numbers alone are meaningless a week later — "Energy 3" is not a memory of
 * anything. The words are the ones the check-in itself offered, so the feed
 * says back what she chose rather than a score she never saw.
 */
const MOOD_WORDS = ["", "Very low", "Low", "Steady", "Good", "Strong"];

function moodWord(value: number | undefined): string {
  const index = Math.round(value ?? 0);
  return MOOD_WORDS[index] ?? "";
}

/** kcal and protein, in the order the food screens already use. */
function mealDetail(entry: FoodEntry): string {
  const parts = [`${Math.round(entry.calories)} kcal`];
  if (entry.protein) parts.push(`${Math.round(entry.protein)}g protein`);
  return parts.join(" · ");
}

function checkInDetail(pulse: PulseEntry): string {
  const parts: string[] = [];
  if (pulse.energy) parts.push(`Energy ${moodWord(pulse.energy).toLowerCase()}`);
  if (pulse.sleep) parts.push(`slept ${moodWord(pulse.sleep).toLowerCase()}`);
  if (pulse.symptoms?.length) parts.push(pulse.symptoms.join(", "));
  return parts.length ? parts.join(" · ") : "Recorded";
}

function workoutDetail(log: WorkoutLog): string {
  const parts = [`Effort ${log.perceivedEffort} of 5`];
  if (log.level) parts.push(log.level);
  /* Said plainly, because a member scanning her week should be able to see
     where something hurt without opening anything. */
  if (log.pain) parts.push("pain reported");
  return parts.join(" · ");
}

/**
 * Which calendar day a relative offset lands on.
 *
 * Offsets are re-based on read — see `lib/day-offset.ts` — so 0 is today and
 * -1 is yesterday by the time anything here sees them.
 */
function dateFromOffset(offset: number, todayIso: string): string {
  const date = new Date(todayIso + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * The unified feed, newest first.
 *
 * `titleFor` is passed in rather than imported so this module stays free of
 * the exercise library and of anything that needs a bundler — the same reason
 * the icon convention keeps `lucide-react-native` out of logic modules.
 */
export function buildLogFeed(
  doc: MemberDoc,
  todayIso: string,
  options: { limit?: number; notes?: MemberNote[] } = {},
): LogItem[] {
  const items: LogItem[] = [];

  for (const entry of doc.foodEntries ?? []) {
    if (entry.deletedAt) continue;
    items.push({
      id: entry.id,
      kind: "meal",
      title: entry.meal,
      detail: mealDetail(entry),
      at: entry.createdAt,
      loggedDate: entry.loggedDate,
    });
  }

  for (const pulse of doc.pulses ?? []) {
    const day = dateFromOffset(pulse.dayOffset ?? 0, todayIso);
    items.push({
      id: pulse.id,
      kind: "checkin",
      title: "Check-in",
      detail: checkInDetail(pulse),
      /* Pulses carry no timestamp, only a day. Noon keeps them ordered
         sensibly against meals without pretending to a precision they do
         not have. */
      at: `${day}T12:00:00.000Z`,
      loggedDate: day,
    });
  }

  for (const log of doc.workoutLogs ?? []) {
    items.push({
      id: log.id,
      kind: "workout",
      title: "Movement",
      detail: workoutDetail(log),
      at: log.completedAt,
      loggedDate: log.completedAt?.slice(0, 10),
    });
  }

  for (const note of options.notes ?? []) {
    if (note.deletedAt) continue;
    items.push({
      id: note.id,
      kind: "note",
      title: "Note",
      detail: note.body,
      at: note.createdAt,
      loggedDate: note.loggedDate,
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return options.limit ? items.slice(0, options.limit) : items;
}

/** "today", "yesterday", or the date, for a feed row. */
export function whenLabel(item: LogItem, todayIso: string): string {
  if (!item.loggedDate) return "";
  if (item.loggedDate === todayIso) return "today";
  if (item.loggedDate === dateFromOffset(-1, todayIso)) return "yesterday";
  const date = new Date(item.loggedDate + "T00:00:00Z");
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * What she has and has not logged today.
 *
 * Drives the hub's prompt. Not a score and not a streak: it exists so the
 * four capture cards can say "done" rather than asking again for something
 * she has already given.
 */
export function loggedToday(
  doc: MemberDoc,
  todayIso: string,
  notes: MemberNote[] = [],
): Record<LogKind, boolean> {
  const feed = buildLogFeed(doc, todayIso, { notes });
  const today = feed.filter((item) => item.loggedDate === todayIso);
  return {
    meal: today.some((item) => item.kind === "meal"),
    checkin: today.some((item) => item.kind === "checkin"),
    workout: today.some((item) => item.kind === "workout"),
    note: today.some((item) => item.kind === "note"),
  };
}
