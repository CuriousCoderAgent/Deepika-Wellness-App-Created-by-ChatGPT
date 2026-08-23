/**
 * Water and small daily habits.
 *
 * Two things the plan does not cover but that members ask about constantly,
 * and both are cheap to log: a glass of water is one tap, a habit is one tap.
 *
 * These store a calendar `date` rather than a relative `dayOffset`. The offset
 * fields elsewhere in this app had to be re-based on read because nothing ever
 * moved them, and yesterday's pulse kept claiming to be today's. Anything added
 * from here on records the day it happened, which cannot drift.
 *
 * The tone rules from the rest of the product apply here too, and they are the
 * reason this file has no "streak" and no "missed". Six glasses out of eight is
 * six glasses, not a two-glass failure. The counters go up and never accuse.
 */

import type { HabitDefinition, HabitLog, HydrationLog, MemberDoc } from "./types";

/**
 * Today, on this device, as YYYY-MM-DD.
 *
 * Defined here rather than in `normalize.ts` so this module has no runtime
 * imports and stays directly testable. `normalize.ts` re-exports it, so there
 * is one definition and every existing caller is unchanged.
 */
export function isoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A glass is 250ml. Eight is the number most people already have in mind. */
export const GLASS_ML = 250;
export const DEFAULT_HYDRATION_TARGET = 8;

/**
 * Suggested habits, offered on first use so the screen is not an empty box
 * with a plus sign. They are deliberately small: the product's whole argument
 * is that a minimum done daily beats a target done once.
 */
export const SUGGESTED_HABITS = [
  "Take my supplements",
  "Stretch for five minutes",
  "Step outside for daylight",
  "Screens off before bed",
  "Sit down to eat",
] as const;

export function hydrationFor(doc: MemberDoc, date = isoDate()): number {
  return (
    doc.hydrationLogs?.find((entry) => entry.date === date)?.glasses ?? 0
  );
}

/**
 * Set today's glass count.
 *
 * Clamped at zero because there is no such thing as negative water, and at a
 * generous upper bound so a stuck finger on the plus button cannot write
 * nonsense into her record.
 */
export function withHydration(
  doc: MemberDoc,
  glasses: number,
  date = isoDate(),
): MemberDoc {
  const next = Math.max(0, Math.min(30, Math.round(glasses)));
  const existing = doc.hydrationLogs ?? [];
  const others = existing.filter((entry) => entry.date !== date);
  const log: HydrationLog = {
    id: existing.find((entry) => entry.date === date)?.id ?? `water-${date}`,
    memberId: doc.member.id,
    date,
    glasses: next,
  };
  return { ...doc, hydrationLogs: [...others, log] };
}

export function activeHabits(doc: MemberDoc): HabitDefinition[] {
  return (doc.habits ?? []).filter((habit) => !habit.archived);
}

export function habitDoneOn(
  doc: MemberDoc,
  habitId: string,
  date = isoDate(),
): boolean {
  return Boolean(
    doc.habitLogs?.some(
      (log) => log.habitId === habitId && log.date === date,
    ),
  );
}

/** One tap on, one tap off. Un-ticking removes the record rather than negating it. */
export function withHabitToggled(
  doc: MemberDoc,
  habitId: string,
  date = isoDate(),
): MemberDoc {
  const logs = doc.habitLogs ?? [];
  const done = logs.some((log) => log.habitId === habitId && log.date === date);
  if (done)
    return {
      ...doc,
      habitLogs: logs.filter(
        (log) => !(log.habitId === habitId && log.date === date),
      ),
    };
  const log: HabitLog = {
    id: `habit-${habitId}-${date}`,
    memberId: doc.member.id,
    habitId,
    date,
  };
  return { ...doc, habitLogs: [...logs, log] };
}

export function withHabitAdded(doc: MemberDoc, label: string): MemberDoc {
  const trimmed = label.trim().slice(0, 60);
  if (!trimmed) return doc;
  const habits = doc.habits ?? [];
  if (
    habits.some(
      (habit) =>
        !habit.archived &&
        habit.label.toLowerCase() === trimmed.toLowerCase(),
    )
  )
    return doc;
  const habit: HabitDefinition = {
    id: `habit-${Date.now()}`,
    memberId: doc.member.id,
    label: trimmed,
    createdAt: new Date().toISOString(),
  };
  return { ...doc, habits: [...habits, habit] };
}

/**
 * Archived, not deleted. Her completions from the weeks she was doing it stay
 * true, and a habit she drops and picks up again keeps its history.
 */
export function withHabitArchived(doc: MemberDoc, habitId: string): MemberDoc {
  return {
    ...doc,
    habits: (doc.habits ?? []).map((habit) =>
      habit.id === habitId ? { ...habit, archived: true } : habit,
    ),
  };
}

/** Days in the last week with at least one habit ticked. Never a streak. */
export function habitDaysThisWeek(doc: MemberDoc, today = isoDate()): number {
  const cutoff = new Date(`${today}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - 6);
  const from = isoDate(cutoff);
  const days = new Set(
    (doc.habitLogs ?? [])
      .filter((log) => log.date >= from && log.date <= today)
      .map((log) => log.date),
  );
  return days.size;
}
