import * as seed from "./seed";
import type { Member } from "./types";

/**
 * A brand-new member's starting point.
 *
 * Everything personal is empty: no actions, no check-ins, no messages, no
 * reports, no food log, no history. What she does get is the shared content
 * library — modules, workouts, articles, the food table — because those are
 * the product's material, not anyone's data.
 *
 * `onboardedAt` is deliberately unset, so she lands in the first-run flow and
 * the app is built from her own answers rather than someone else's.
 */
export function newMember(id: string, name: string): Member {
  return {
    id,
    name,
    city: "",
    initials: name
      .split(" ")
      .map((p) => p.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    // Unset, not a guess. Onboarding asks for it and will not let her past
    // that screen without a real answer between 18 and 99, so nothing
    // downstream sees this zero for long — and it is better than opening her
    // first question with a made-up age she has to delete.
    age: 0,
    week: 1,
    phase: "Stabilise",
    lifeStage: "",
    goals: [],
    constraints: [],
    wontDo: "",
    medical: [],
    medications: [],
    engagement: "steady",
    weeklyFocus: [],
    activeModuleIds: [],
    bodyComp: [],
    assessmentComplete: 0,
  };
}

/**
 * State for an account that is not the seeded demo member.
 *
 * Note what this means in practice while there is no database: her data lives
 * in her own browser, so Deepika's console cannot see it. The console shows
 * the seeded cohort instead. Cross-account visibility is Sprint B in
 * docs/V1-ROADMAP.md and is the main thing the database unblocks.
 */
export function emptyStateFor(id: string, name: string) {
  return {
    members: [newMember(id, name)],
    modules: seed.modules,
    workouts: seed.workouts,
    articles: seed.articles,
    foodItems: seed.foodItems,
    foodEntries: [],
    actions: [],
    pulses: [],
    workoutLogs: [],
    messages: [],
    sessions: [],
    reports: [],
    feedback: [],
    resolvedRadar: [],
    activeMemberId: id,
  };
}
