/**
 * Awards: what counts, and when each is earned.
 *
 * Extracted from App.tsx so the rules can be tested and a redesign can redraw
 * the badges without touching them. The data and the arithmetic live here;
 * what a badge looks like stays with the screen.
 *
 * Icons are *named* rather than imported. The screen maps a name to a
 * component, which keeps this module free of lucide-react-native and
 * therefore importable by the test runner — otherwise these thresholds stay
 * untested purely because the file they lived in pulled in React Native.
 *
 * ## What the rules encode
 *
 * Fitness apps award three things: cumulative volume, consistency over time,
 * and one-off firsts. All three are here, plus one rule of ours — nothing
 * rewards intensity, and nothing can ever be taken away. A badge that
 * disappears is a streak wearing a different hat.
 *
 * Two counting mistakes were fixed here and must not come back, because each
 * told a member something untrue about her own week:
 *
 * - **Rest is not activity.** It stays recorded and has its own award, but a
 *   day whose only entry was "not today" is not a day she showed up.
 * - **A session is a day, not an exercise.** Counting each completed movement
 *   meant one ordinary morning of six read as six sessions, so "thirty
 *   sessions" was reachable in a fortnight.
 */

import { liveMeals } from "./meals";
import type { MemberDoc } from "./types";

/**
 * Icon names, resolved to components by the screen. A union rather than a
 * string so a typo is a type error instead of a blank badge.
 */
export type AwardIcon =
  | "sparkles"
  | "check"
  | "trophy"
  | "calendar"
  | "home"
  | "dumbbell"
  | "footprints"
  | "utensils"
  | "heart"
  | "moon"
  | "shield"
  | "users";

export interface AwardMetrics {
  actions: number;
  activeDays: number;
  wholeDays: number;
  movements: number;
  walks: number;
  meals: number;
  checkIns: number;
  rests: number;
  circleSize: number;
  healthConnected: boolean;
}

export const AWARDS: {
  id: string;
  icon: AwardIcon;
  title: string;
  copy: string;
  /** Earned when this returns true. Pure, so it stays easy to reason about. */
  earned: (m: AwardMetrics) => boolean;
  /** How far along she is, shown only while it is still unearned. */
  progress?: (m: AwardMetrics) => string;
}[] = [
  {
    id: "first-step",
    icon: "sparkles",
    title: "First step",
    copy: "Your first completed action. Everything else is built on this one.",
    earned: (m) => m.actions >= 1,
  },
  {
    id: "five-actions",
    icon: "check",
    title: "Finding a rhythm",
    copy: "Five actions — proof that small efforts accumulate.",
    earned: (m) => m.actions >= 5,
    progress: (m) => `${m.actions} of 5 actions`,
  },
  {
    id: "twelve-actions",
    icon: "trophy",
    title: "Showing up",
    copy: "Twelve actions, across real-life days rather than perfect ones.",
    earned: (m) => m.actions >= 12,
    progress: (m) => `${m.actions} of 12 actions`,
  },
  {
    id: "fifty-actions",
    icon: "trophy",
    title: "Fifty in",
    copy: "Fifty completed actions. This is a habit now, not an experiment.",
    earned: (m) => m.actions >= 50,
    progress: (m) => `${m.actions} of 50 actions`,
  },
  {
    id: "hundred-actions",
    icon: "trophy",
    title: "One hundred",
    // No population claim. We have no retention data to support one, and
    // inventing a statistic to make an award feel bigger is the kind of thing
    // that costs trust the first time someone checks.
    copy: "A hundred actions, one at a time.",
    earned: (m) => m.actions >= 100,
    progress: (m) => `${m.actions} of 100 actions`,
  },
  {
    id: "week-active",
    icon: "calendar",
    title: "A full week",
    copy: "Seven separate days with something completed on them.",
    earned: (m) => m.activeDays >= 7,
    progress: (m) => `${m.activeDays} of 7 days`,
  },
  {
    id: "month-active",
    icon: "calendar",
    title: "A month of days",
    copy: "Twenty-eight days with something on them. They did not have to be in a row.",
    earned: (m) => m.activeDays >= 28,
    progress: (m) => `${m.activeDays} of 28 days`,
  },
  {
    id: "whole-day",
    icon: "home",
    title: "The whole day",
    copy: "One day where every part of the plan got something — movement, walking, food, rest and mind.",
    earned: (m) => m.wholeDays >= 1,
  },
  {
    id: "movement-ten",
    icon: "dumbbell",
    title: "Ten sessions",
    copy: "Ten days you did your movement session.",
    earned: (m) => m.movements >= 10,
    progress: (m) => `${m.movements} of 10 sessions`,
  },
  {
    id: "movement-thirty",
    icon: "dumbbell",
    title: "Thirty sessions",
    copy: "Thirty days of movement. That is enough time for real change.",
    earned: (m) => m.movements >= 30,
    progress: (m) => `${m.movements} of 30 sessions`,
  },
  {
    id: "walk-ten",
    icon: "footprints",
    title: "Walking it off",
    copy: "Ten walks completed — the ten minutes after a meal that do the most work.",
    earned: (m) => m.walks >= 10,
    progress: (m) => `${m.walks} of 10 walks`,
  },
  {
    id: "first-meal",
    icon: "utensils",
    title: "First meal logged",
    copy: "One meal written down tells you more than a week you tried to remember.",
    earned: (m) => m.meals >= 1,
  },
  {
    id: "meals-twenty",
    icon: "utensils",
    title: "Twenty meals",
    copy: "Enough meals recorded for your own patterns to become visible.",
    earned: (m) => m.meals >= 20,
    progress: (m) => `${m.meals} of 20 meals`,
  },
  {
    id: "checkins-ten",
    icon: "heart",
    title: "Paying attention",
    copy: "Ten check-ins. Noticing how you feel is its own skill.",
    earned: (m) => m.checkIns >= 10,
    progress: (m) => `${m.checkIns} of 10 check-ins`,
  },
  {
    id: "rest-taken",
    icon: "moon",
    title: "Rest counts",
    copy: "You chose rest and recorded it. That is a decision, not a gap.",
    earned: (m) => m.rests >= 1,
  },
  {
    id: "health-connected",
    icon: "shield",
    title: "Connected",
    copy: "Your health source is linked, so steps count themselves.",
    earned: (m) => m.healthConnected,
  },
  {
    id: "circle-joined",
    icon: "users",
    title: "Not alone",
    copy: "Someone is in your circle. Company makes this considerably easier.",
    earned: (m) => m.circleSize >= 1,
  },
];

export function awardMetrics(doc: MemberDoc): AwardMetrics {
  const done = (doc.actions ?? []).filter((action) => action.completed);
  // Rest is a real and valued choice, and it stays recorded — but it is not
  // activity, and counting it as such inflated every day-based award. A day
  // whose only entry was "not today" used to register as an active day.
  const active = done.filter((action) => action.completed !== "rest");

  const domainsByDay = new Map<number, Set<string>>();
  for (const action of active) {
    if (!domainsByDay.has(action.dayOffset))
      domainsByDay.set(action.dayOffset, new Set());
    domainsByDay.get(action.dayOffset)!.add(action.domain);
  }

  // A session is a day she trained, not an exercise she finished. Counting
  // each exercise meant one ordinary morning of six movements read as six
  // sessions, so "Thirty sessions" was reachable in a fortnight — which makes
  // the award meaningless and, worse, tells her something untrue about what
  // she has done.
  const movementDays = new Set(
    active
      .filter((action) => action.domain === "movement")
      .map((action) => action.dayOffset),
  ).size;

  const health = doc.healthConnection?.status;
  return {
    actions: active.length,
    activeDays: domainsByDay.size,
    wholeDays: [...domainsByDay.values()].filter((set) => set.size >= 5).length,
    movements: movementDays,
    walks: active.filter((action) => action.domain === "walking").length,
    meals: liveMeals(doc).length,
    checkIns: doc.pulses?.length ?? 0,
    rests: done.filter((action) => action.completed === "rest").length,
    circleSize: doc.engagement?.circle?.memberCount ?? 0,
    healthConnected: health === "connected" || health === "partial",
  };
}
