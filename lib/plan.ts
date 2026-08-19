import type { Member, WeekPlan } from "./types";

/**
 * 12-week phase ranges. Single source of truth so the coach console and the
 * member app never disagree about which weeks belong to which phase.
 */
export const PHASE_WEEKS: Record<WeekPlan["phase"], [number, number]> = {
  Stabilise: [1, 4],
  Build: [5, 8],
  Consolidate: [9, 12],
};

export function phaseForWeek(week: number): WeekPlan["phase"] {
  if (week <= 4) return "Stabilise";
  if (week <= 8) return "Build";
  return "Consolidate";
}

/**
 * The published 12-week plan. Members seeded before weekPlans existed don't
 * have one on disk (including anything already in a user's localStorage) —
 * synthesise it from their live state rather than forcing a migration.
 */
export function weekPlansFor(m: Member): WeekPlan[] {
  if (m.weekPlans && m.weekPlans.length === 12) return m.weekPlans;
  return Array.from({ length: 12 }, (_, i) => {
    const week = i + 1;
    return {
      week,
      phase: phaseForWeek(week),
      focus: week === m.week ? m.weeklyFocus : [],
      moduleIds: m.activeModuleIds,
    };
  });
}

/** Draft mirrors the published plan until the coach edits a week. */
export function draftWeekPlansFor(m: Member): WeekPlan[] {
  return m.draftWeekPlans && m.draftWeekPlans.length === 12 ? m.draftWeekPlans : weekPlansFor(m);
}
