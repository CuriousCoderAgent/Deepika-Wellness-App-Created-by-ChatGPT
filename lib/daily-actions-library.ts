/**
 * The other four domains.
 *
 * Movement had a library and a generator; nutrition, walking, recovery and
 * mindset had a placeholder that said "no target has been published for today"
 * and asked her to think about the domain. That copy was written for a product
 * where a coach published these, and in a coach-optional app it apologises for
 * the absence of someone who was never coming.
 *
 * Same approach as the exercise bank: a curated, tagged set, chosen by rules
 * from what she has actually told the app. Nothing is generated from nothing.
 *
 * The selection signals are all things already collected and, until now, mostly
 * unread — what she logged, how she rated her sleep, whether she connected a
 * step source, what she said her goals were.
 *
 * Tone rules from the rest of the product apply, and they matter most here.
 * These are the domains where it is easiest to write something that sounds like
 * a telling-off. No action assumes she did badly, none references a streak, and
 * every one is achievable on the worst day of a bad week.
 */

import type { ActionDomain } from "./types";

export interface DailyActionTemplate {
  id: string;
  domain: Exclude<ActionDomain, "movement">;
  title: string;
  why: string;
  minimum: string;
  target: string;
  stretch: string;
  measurement: {
    kind: "minutes" | "meal" | "steps" | "serving" | "check_in";
    value: number;
    unit: string;
  };
  /**
   * When this is worth offering. Every field is optional; a template with no
   * conditions is always eligible and acts as the dependable default.
   */
  when?: {
    goals?: string[];
    /** Offer when her recent sleep ratings are low. */
    poorSleep?: boolean;
    /** Offer when her recent stress ratings are low (meaning high stress). */
    highStress?: boolean;
    /** Offer when she has logged little or no food recently. */
    lowFoodLogging?: boolean;
    /** Offer when protein has been consistently low in what she logged. */
    lowProtein?: boolean;
    /** Offer only when a step source is connected, or only when it is not. */
    stepsConnected?: boolean;
  };
  /** Higher wins when several templates fit. Ties break on order here. */
  weight?: number;
}

export const DAILY_ACTIONS: DailyActionTemplate[] = [
  /* ---------------------------------------------------------------- */
  /* Nutrition                                                         */
  /* ---------------------------------------------------------------- */
  {
    id: "nut-protein-anchor",
    domain: "nutrition",
    title: "Anchor one meal with protein",
    why: "Protein at a meal is the single change that most reliably steadies energy through the afternoon.",
    minimum: "Add dal, curd or eggs to one meal",
    target: "A protein source at two meals",
    stretch: "Protein at every meal today",
    measurement: { kind: "meal", value: 1, unit: "meal" },
    when: { lowProtein: true },
    weight: 3,
  },
  {
    id: "nut-log-one",
    domain: "nutrition",
    title: "Record your meals",
    why: "One meal written down tells you more about your week than trying to remember it later.",
    minimum: "Record one meal",
    target: "Record two meals",
    stretch: "Record the whole day",
    measurement: { kind: "meal", value: 1, unit: "meal" },
    when: { lowFoodLogging: true },
    weight: 2,
  },
  {
    id: "nut-vegetable",
    domain: "nutrition",
    title: "Add something green",
    why: "A vegetable at lunch or dinner is a small change that does not require reorganising your cooking.",
    minimum: "One vegetable at any meal",
    target: "Vegetables at two meals",
    stretch: "Something raw as well — salad or kachumber",
    measurement: { kind: "serving", value: 1, unit: "serving" },
  },
  {
    id: "nut-breakfast",
    domain: "nutrition",
    title: "Eat something within an hour of waking",
    why: "Starting the day fed makes the rest of it far easier to steer.",
    minimum: "Anything at all, even small",
    target: "Something with protein in it",
    stretch: "Sit down for it",
    measurement: { kind: "meal", value: 1, unit: "meal" },
    when: { goals: ["steadier energy"] },
    weight: 2,
  },
  {
    id: "nut-slow-meal",
    domain: "nutrition",
    title: "Sit down for one meal",
    why: "Eating standing up, between other things, is how a meal stops registering as one.",
    minimum: "One meal sitting down",
    target: "Sitting down, without your phone",
    stretch: "Notice when you have had enough",
    measurement: { kind: "meal", value: 1, unit: "meal" },
    when: { highStress: true },
    weight: 2,
  },

  /* ---------------------------------------------------------------- */
  /* Walking                                                           */
  /* ---------------------------------------------------------------- */
  {
    id: "walk-after-meal",
    domain: "walking",
    title: "Walk after a meal",
    why: "Ten minutes after eating does more for how you feel afterwards than the same ten minutes at any other time.",
    minimum: "Five minutes, even around the house",
    target: "Ten minutes after your largest meal",
    stretch: "Fifteen minutes, outdoors",
    measurement: { kind: "minutes", value: 10, unit: "minutes" },
    when: { stepsConnected: false },
    weight: 2,
  },
  {
    id: "walk-steps",
    domain: "walking",
    title: "Add a few hundred steps to yesterday",
    why: "Small increases you keep beat large ones you abandon.",
    minimum: "Match yesterday",
    target: "A few hundred more than yesterday",
    stretch: "A thousand more",
    measurement: { kind: "steps", value: 500, unit: "steps" },
    when: { stepsConnected: true },
    weight: 3,
  },
  {
    id: "walk-morning-light",
    domain: "walking",
    title: "Get outside in the morning",
    why: "Daylight early in the day is one of the few things that reliably shifts how you sleep that night.",
    minimum: "Step outside for two minutes",
    target: "Ten minutes outdoors before mid-morning",
    stretch: "Walk while you are out there",
    measurement: { kind: "minutes", value: 10, unit: "minutes" },
    when: { poorSleep: true },
    weight: 3,
  },
  {
    id: "walk-break",
    domain: "walking",
    title: "Break up the sitting",
    why: "Getting up every hour changes more than one long walk at the end of a seated day.",
    minimum: "Stand up twice",
    target: "A short walk every couple of hours",
    stretch: "Take a call standing or walking",
    measurement: { kind: "check_in", value: 1, unit: "break" },
  },

  /* ---------------------------------------------------------------- */
  /* Recovery                                                          */
  /* ---------------------------------------------------------------- */
  {
    id: "rec-winddown",
    domain: "recovery",
    title: "A short wind-down before bed",
    why: "Sleep improves more from the half hour before it than from anything you do in bed.",
    minimum: "Five quiet minutes",
    target: "Fifteen minutes without a screen",
    stretch: "Same time as last night",
    measurement: { kind: "minutes", value: 15, unit: "minutes" },
    when: { poorSleep: true },
    weight: 3,
  },
  {
    id: "rec-consistent-time",
    domain: "recovery",
    title: "Go to bed near the same time",
    why: "A regular bedtime does more for how rested you feel than an extra hour at the weekend.",
    minimum: "Within an hour of usual",
    target: "Within half an hour",
    stretch: "Wake at the same time too",
    measurement: { kind: "check_in", value: 1, unit: "night" },
    when: { goals: ["sleep more consistently"] },
    weight: 3,
  },
  {
    id: "rec-legs-up",
    domain: "recovery",
    title: "Five minutes with your legs up",
    why: "Five minutes here does more for tired legs than almost anything else, and asks nothing of you.",
    minimum: "Two minutes",
    target: "Five minutes",
    stretch: "Ten, with your eyes closed",
    measurement: { kind: "minutes", value: 5, unit: "minutes" },
  },
  {
    id: "rec-caffeine",
    domain: "recovery",
    title: "Last chai before four",
    why: "Caffeine is still working on you six hours later, whether or not you feel it.",
    minimum: "Notice when your last one was",
    target: "Nothing caffeinated after four",
    stretch: "Swap the evening one for something warm",
    measurement: { kind: "check_in", value: 1, unit: "check-in" },
    when: { poorSleep: true },
    weight: 2,
  },

  /* ---------------------------------------------------------------- */
  /* Mindset                                                           */
  /* ---------------------------------------------------------------- */
  {
    id: "mind-breathing",
    domain: "mindset",
    title: "Two minutes of slow breathing",
    why: "The fastest thing that works when a day is getting away from you, and it needs nothing.",
    minimum: "Ten slow breaths",
    target: "Two minutes",
    stretch: "Five minutes, sitting still",
    measurement: { kind: "minutes", value: 2, unit: "minutes" },
    when: { highStress: true },
    weight: 3,
  },
  {
    id: "mind-one-line",
    domain: "mindset",
    title: "Write one line about today",
    why: "A sentence a day is enough to notice a pattern you would otherwise argue with yourself about.",
    minimum: "A few words",
    target: "One honest line",
    stretch: "Note what you would like tomorrow to hold",
    measurement: { kind: "check_in", value: 1, unit: "reflection" },
  },
  {
    id: "mind-one-good",
    domain: "mindset",
    title: "Name one thing that went well",
    why: "Difficult days are easier to see clearly when something on the other side of the ledger is written down.",
    minimum: "Think of one",
    target: "Write it down",
    stretch: "Tell someone",
    measurement: { kind: "check_in", value: 1, unit: "reflection" },
    when: { goals: ["manage stress"] },
    weight: 2,
  },
  {
    id: "mind-pause",
    domain: "mindset",
    title: "Pause before the evening starts",
    why: "A deliberate gap between the working day and the evening stops one bleeding into the other.",
    minimum: "One minute of nothing",
    target: "Five minutes before you start the evening",
    stretch: "Somewhere other than where you work",
    measurement: { kind: "minutes", value: 5, unit: "minutes" },
    when: { highStress: true },
    weight: 2,
  },
];

export interface DomainSignals {
  goals: string[];
  poorSleep: boolean;
  highStress: boolean;
  lowFoodLogging: boolean;
  lowProtein: boolean;
  stepsConnected: boolean;
  /** Ids offered in the last few days, so today is not a repeat. */
  recentlyOffered?: string[];
}

/**
 * Choose one action per domain.
 *
 * Conditional templates outrank unconditional ones, because a template that
 * matched something she actually reported is by definition more relevant than
 * the dependable default. Where nothing matches, the default is still a real
 * action rather than an apology about an absent coach.
 */
export function selectDailyActions(
  signals: DomainSignals,
): DailyActionTemplate[] {
  const goals = new Set(signals.goals.map((goal) => goal.trim().toLowerCase()));
  const recent = new Set(signals.recentlyOffered ?? []);
  const domains: DailyActionTemplate["domain"][] = [
    "walking",
    "nutrition",
    "recovery",
    "mindset",
  ];

  return domains.map((domain) => {
    const candidates = DAILY_ACTIONS.filter(
      (template) => template.domain === domain && matches(template, signals, goals),
    );
    // Prefer something she has not just been given, but never at the cost of
    // offering nothing.
    const fresh = candidates.filter((template) => !recent.has(template.id));
    const pool = fresh.length ? fresh : candidates;
    return pool.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0]!;
  });
}

function matches(
  template: DailyActionTemplate,
  signals: DomainSignals,
  goals: Set<string>,
): boolean {
  const when = template.when;
  if (!when) return true;
  if (when.goals && !when.goals.some((goal) => goals.has(goal))) return false;
  if (when.poorSleep && !signals.poorSleep) return false;
  if (when.highStress && !signals.highStress) return false;
  if (when.lowFoodLogging && !signals.lowFoodLogging) return false;
  if (when.lowProtein && !signals.lowProtein) return false;
  if (when.stepsConnected !== undefined && when.stepsConnected !== signals.stepsConnected)
    return false;
  return true;
}
