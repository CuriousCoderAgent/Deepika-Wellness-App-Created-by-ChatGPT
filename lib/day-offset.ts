/**
 * Keeping "today" actually meaning today.
 *
 * Actions, pulses, messages, sessions and workout logs are stored with a
 * relative `dayOffset` — 0 is today, -1 is yesterday. Nothing in the product
 * ever moved those numbers, so a pulse recorded on Monday still claimed to be
 * today's on Tuesday: Today showed yesterday's completed actions as already
 * done, the Daily Pulse looked filled in, and the consistency counts drifted.
 *
 * A relative index is only meaningful next to the day it was written from, so
 * every document records that day as `dayOffsetAnchor` and is re-based on read.
 * This is the one place that knows how to do it, and it runs inside `lib/db.ts`
 * so the coach console and the mobile app cannot disagree about what day it is.
 *
 * Anything already carrying a calendar date — food entries, health snapshots,
 * recommendations — is authoritative and is recomputed from that date rather
 * than shifted, which also repairs documents that drifted before this existed.
 */

const DAY_MS = 86_400_000;

/**
 * Members and coach are in India. A UTC "today" would roll the day over at
 * 05:30 IST, in the middle of the night, so the boundary is computed in a real
 * timezone. Override only if the practice moves.
 */
const APP_TIMEZONE = process.env.BHAROSA_TIMEZONE || "Asia/Kolkata";

const dateParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today where the member is, as `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the format we store.
  return dateParts.format(now);
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Whole days from `from` to `to`. Midday avoids DST edges either side. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T12:00:00Z`);
  const b = Date.parse(`${to}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / DAY_MS);
}

/** The calendar date an offset refers to, relative to today. */
export function dateFromOffset(dayOffset: number, today = todayIso()): string {
  const base = Date.parse(`${today}T12:00:00Z`);
  return new Date(base + dayOffset * DAY_MS).toISOString().slice(0, 10);
}

/** The offset a calendar date has today. Past dates are negative. */
export function offsetFromDate(date: string, today = todayIso()): number {
  return daysBetween(today, date);
}

type Dated = { dayOffset?: number } & Record<string, unknown>;

/** Collections whose `dayOffset` is relative and therefore needs shifting. */
const RELATIVE_COLLECTIONS = [
  "actions",
  "pulses",
  "workoutLogs",
  "messages",
  "sessions",
] as const;

function shiftCollection<T extends Dated>(rows: T[] | undefined, shift: number) {
  if (!Array.isArray(rows) || shift === 0) return rows;
  return rows.map((row) =>
    typeof row?.dayOffset === "number"
      ? { ...row, dayOffset: row.dayOffset - shift }
      : row,
  );
}

/**
 * Entries that carry their own calendar date are recomputed from it. That is
 * both more accurate than shifting and self-healing for documents written
 * before the anchor existed.
 */
function realignByDate<T extends Dated>(
  rows: T[] | undefined,
  dateKey: string,
  today: string,
  shift: number,
) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const date = row?.[dateKey];
    if (isValidIsoDate(date)) {
      const dayOffset = offsetFromDate(date, today);
      return dayOffset === row.dayOffset ? row : { ...row, dayOffset };
    }
    if (shift === 0 || typeof row?.dayOffset !== "number") return row;
    // No date recorded: shift like everything else, and stamp the date it
    // resolves to so this entry never has to be guessed at again.
    const dayOffset = row.dayOffset - shift;
    return { ...row, dayOffset, [dateKey]: dateFromOffset(dayOffset, today) };
  });
}

/** Any stored document that records the day its offsets were written from. */
export interface RebaseableDoc {
  dayOffsetAnchor?: string;
}

/**
 * Move a document's relative day offsets onto today.
 *
 * A document with no anchor is assumed to have been written today, which is
 * exactly how the product behaved before this existed — so an unmigrated
 * document is never made worse, only stamped so the next day is correct.
 */
export function rebaseMemberDoc<T extends RebaseableDoc>(
  doc: T,
  now: Date = new Date(),
): T {
  if (!doc || typeof doc !== "object") return doc;
  const src = doc as unknown as Record<string, unknown>;
  const today = todayIso(now);
  const anchor = isValidIsoDate(doc.dayOffsetAnchor)
    ? doc.dayOffsetAnchor
    : today;
  const shift = daysBetween(anchor, today);

  // Clock skew, or a document written from a device set to a future date.
  // Shifting backwards would move logged days into the future, so hold still
  // and re-anchor instead.
  const safeShift = shift > 0 ? shift : 0;

  const next: Record<string, unknown> = { ...src, dayOffsetAnchor: today };
  for (const key of RELATIVE_COLLECTIONS) {
    const shifted = shiftCollection(src[key] as Dated[] | undefined, safeShift);
    if (shifted) next[key] = shifted;
  }
  const food = realignByDate(
    src.foodEntries as Dated[] | undefined,
    "loggedDate",
    today,
    safeShift,
  );
  if (food) next.foodEntries = food;
  return next as T;
}

/** Stamp a document being written with the day its offsets are relative to. */
export function anchorMemberDoc<T extends RebaseableDoc>(
  doc: T,
  now: Date = new Date(),
): T {
  if (!doc || typeof doc !== "object") return doc;
  return { ...doc, dayOffsetAnchor: todayIso(now) };
}
