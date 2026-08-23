/**
 * What one member may see about another.
 *
 * This module exists to make the sharing boundary a single, readable thing
 * rather than a decision spread across route handlers. A member's document
 * holds her meals, photos, blood reports, coach messages, mood and symptoms.
 * None of that is shareable. What a friend sees is a *projection* built here:
 * how much of today's plan she has done, how many days she has shown up this
 * week, and — only if she has connected a health source and opted in — her step
 * count.
 *
 * The rule is that this file returns a new object built field by field. It
 * never spreads a member document, so a field added to `MemberDoc` later cannot
 * silently become public.
 *
 * On the competitive framing: comparison is what the member asked for, and it
 * is a real motivator. But the product's north star is a graceful return after
 * imperfect days, so the projection deliberately carries no failure signal —
 * there is no "missed", no zero-streak, no red. Someone who has done nothing
 * today looks the same as someone who has not opened the app yet, because to
 * everyone else those are the same thing and neither is anyone's business.
 */

import type { MemberDoc } from "./persist";

/** Everything a connected member is allowed to see. */
export interface CircleActivity {
  memberId: string;
  displayName: string;
  /** Today's plan: how many supportive actions are done, out of how many. */
  actionsCompleted: number;
  actionsTotal: number;
  /** Days in the last seven with at least one action completed. */
  activeDays: number;
  /** Present only when she has a health source connected and shares steps. */
  steps?: number;
  /** Glasses of water today, when she is logging them. */
  hydrationGlasses?: number;
  /** Coarse, and never more precise than this. */
  city?: string;
}

const DAY_MS = 86_400_000;

function isoDay(value: string | undefined): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

/**
 * Days in the last week on which she completed something.
 *
 * "rest" counts as showing up. Deciding not to train today is a legitimate
 * choice the product treats as success, and it would be perverse for the one
 * screen her friends see to be the one place that calls it a gap.
 */
function activeDaysFor(doc: MemberDoc): number {
  const days = new Set<number>();
  for (const action of doc.actions ?? []) {
    if (!action.completed) continue;
    if (action.dayOffset > 0 || action.dayOffset < -6) continue;
    days.add(action.dayOffset);
  }
  return days.size;
}

function todaySteps(doc: MemberDoc, today: string): number | undefined {
  const snapshots = doc.healthSnapshots ?? [];
  const step = snapshots.find(
    (snapshot) =>
      snapshot.metric === "steps" &&
      snapshot.available &&
      isoDay(snapshot.date) === today,
  );
  return step && Number.isFinite(step.value)
    ? Math.max(0, Math.round(step.value))
    : undefined;
}

function todayHydration(doc: MemberDoc, today: string): number | undefined {
  const log = (doc.hydrationLogs ?? []).find(
    (entry) => isoDay(entry.date) === today,
  );
  return log ? Math.max(0, Math.round(log.glasses)) : undefined;
}

/**
 * Build the shareable view of one member's day.
 *
 * `displayName` and `city` come from her circle profile, not her member
 * record, so what her friends call her is hers to set and is not tied to the
 * name her coach uses.
 */
export function activityFor(
  memberId: string,
  doc: MemberDoc | null,
  profile: { displayName: string; city?: string | null },
  today: string,
): CircleActivity {
  const todayActions = (doc?.actions ?? []).filter(
    (action) => action.dayOffset === 0,
  );
  return {
    memberId,
    displayName: profile.displayName || "Member",
    actionsCompleted: todayActions.filter((action) => action.completed).length,
    actionsTotal: todayActions.length,
    activeDays: doc ? activeDaysFor(doc) : 0,
    steps: doc ? todaySteps(doc, today) : undefined,
    hydrationGlasses: doc ? todayHydration(doc, today) : undefined,
    city: profile.city ?? undefined,
  };
}

/**
 * Order a circle for display.
 *
 * Ranked by days shown up this week, then by today's progress — consistency
 * rather than intensity, so the person doing gentle ten-minute walks every day
 * places above the person who did one hard session and nothing since. That is
 * the behaviour the product is actually trying to encourage.
 *
 * Ties keep a stable order by name so the list does not shuffle between
 * refreshes for no visible reason.
 */
export function rankByConsistency(rows: CircleActivity[]): CircleActivity[] {
  return [...rows].sort((a, b) => {
    if (b.activeDays !== a.activeDays) return b.activeDays - a.activeDays;
    const aShare = a.actionsTotal ? a.actionsCompleted / a.actionsTotal : 0;
    const bShare = b.actionsTotal ? b.actionsCompleted / b.actionsTotal : 0;
    if (bShare !== aShare) return bShare - aShare;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** Cities are compared case- and space-insensitively, and stored as typed. */
export function normaliseCity(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 64) return null;
  return trimmed;
}

/**
 * The name her circle sees. Defaults to her first name only: a pilot member
 * discoverable to strangers in her city should not be handing over her full
 * name to do it.
 */
export function normaliseDisplayName(raw: unknown, fallback = ""): string {
  const source = typeof raw === "string" && raw.trim() ? raw : fallback;
  const trimmed = source.trim().replace(/\s+/g, " ").slice(0, 40);
  return trimmed || "Member";
}

export const DAY_IN_MS = DAY_MS;
