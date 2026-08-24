/**
 * Fixed lists the app shows: labels, options and the words on them.
 *
 * Out of the screen file because these are content decisions, several of
 * which are deliberate in ways a passing edit could undo. They are also the
 * pieces most likely to need translating first, and a Hindi build should not
 * mean editing an eight-thousand-line component.
 *
 * Icons are named rather than imported, the same convention as
 * `./awards` — it keeps this module free of React Native so tests and
 * tooling can read it.
 */

import type { ActionDomain, HealthMetric } from "./types";

/** Icon names resolved to components by the screen. */
export type DomainIcon =
  | "dumbbell"
  | "footprints"
  | "utensils"
  | "moon"
  | "brain";

/**
 * The five domains, and what a member sees them called.
 *
 * The labels are hers, not the code's: `movement` reads as "Strength &
 * mobility" because that is what it is to somebody doing it, and no member
 * ever sees the word "domain".
 */
export const DOMAIN_META: Record<
  ActionDomain,
  { label: string; icon: DomainIcon }
> = {
  movement: { label: "Strength & mobility", icon: "dumbbell" },
  walking: { label: "Walking", icon: "footprints" },
  nutrition: { label: "Nutrition", icon: "utensils" },
  recovery: { label: "Sleep & recovery", icon: "moon" },
  mindset: { label: "Stress & reflection", icon: "brain" },
};

/**
 * What she can flag on a check-in.
 *
 * Neutral descriptions of what she noticed, never interpretations of what it
 * means. "Cycle change" is a thing she observed; "hormonal fluctuation" would
 * be a conclusion the app is not entitled to draw, and reporting one of these
 * is what routes a check-in for human review rather than triggering any
 * automated inference.
 */
export const BODY_SIGNALS = [
  "Night waking",
  "Hot flushes or night sweats",
  "Cycle change",
  "Headache",
  "Bloating",
  "Unusual soreness",
  "Low mood",
  "Coach input requested",
] as const;

/**
 * The complete set of things one member may send another.
 *
 * Fixed, and deliberately so — there is no free text between members. A nudge
 * cannot become a channel for anything unkind, and nobody has to compose
 * something. Every one of these says "thinking of you" and none says
 * anything about what she did or did not do; the same message turned into a
 * comment on her week would be a reprimand.
 */
export const NUDGE_OPTIONS = [
  { kind: "thinking_of_you", label: "Thinking of you today" },
  { kind: "well_done", label: "Well done" },
  { kind: "keep_going", label: "Keep going" },
  { kind: "proud", label: "Proud of you" },
] as const;

/**
 * Health metrics, named for a person rather than an API.
 *
 * Heart-rate variability is written out rather than "HRV" on purpose, and
 * carries no method here — Apple reports SDNN and Health Connect reports
 * RMSSD, they are not the same measurement, and the provenance that says
 * which travels with the reading itself rather than with the label.
 */
export const HEALTH_LABELS: Record<
  HealthMetric,
  { label: string; unit: string }
> = {
  steps: { label: "Steps", unit: "steps" },
  restingHeartRate: { label: "Resting heart rate", unit: "bpm" },
  heartRateVariability: { label: "Heart-rate variability", unit: "ms" },
  vo2Max: { label: "VO₂ max", unit: "ml/kg/min" },
};

/**
 * Module ids to the names they were given.
 *
 * The Plan screen rendered the raw id with its hyphens swapped for spaces, so
 * a member's week was labelled "mv strength a" and "hr perimenopause". Every
 * one of these already had a proper name in the content library; the screen
 * had simply never been given it.
 *
 * Unknown ids fall back to the old de-hyphenated form via `moduleName()` —
 * ugly, but a legible fallback beats a blank chip, and a module published
 * later should not vanish from a plan because this map has not caught up.
 */
const MODULE_NAMES: Record<string, string> = {
  "mv-strength-a": "Strength Foundations",
  "mv-strength-b": "Balance & Carry",
  "mv-mobility-10": "10-minute Mobility",
  "mv-walk-base": "Walking Base",
  "nu-protein": "Protein Basics",
  "nu-plate": "Plate Structure",
  "sl-reset": "Sleep Reset Week",
  "sl-winddown": "Evening Wind-down",
  "hr-perimenopause": "Understanding Perimenopause",
  "hr-bone-muscle": "Bone & Muscle Health",
  "hr-doctor-questions": "Preparing Questions for Your Doctor",
  "bh-minimum-day": "Minimum Day",
  "bh-if-then": "If-Then Planning",
  "bh-comeback": "Comeback Week",
};

/** What a member should see a module called. Never the raw id. */
export function moduleName(id: string): string {
  return MODULE_NAMES[id] ?? id.replace(/[-_]/g, " ");
}
