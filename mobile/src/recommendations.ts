/**
 * What today should say about the most recent recommendation.
 *
 * Recommendations accumulate — nothing here is ever deleted or marked
 * resolved. That is deliberate for the record itself, but two places on
 * Today used to read that growing list the wrong way: they scanned every
 * entry ever written and surfaced the first "needs a human" flag they found,
 * however old. On a coach-optional account there is nothing that ever clears
 * such a flag, so one historical entry — a pain report from three weeks ago,
 * or, until the trigger itself was fixed, simply having picked a goal at
 * sign-up — pre-empted the plan explanation and the coach card forever.
 *
 * What should decide what shows today is what is current, not what has ever
 * happened once. A fresh, ordinary day supersedes an old flag the same way a
 * fresh log supersedes an old one everywhere else in this product.
 */

import type { AiRecommendation, MemberDoc } from "./types";

/** The most recent recommendation, or null if none exist yet. */
export function latestRecommendation(doc: MemberDoc): AiRecommendation | null {
  const list = doc.recommendations ?? [];
  if (!list.length) return null;
  // Appended in order server-side, but sorted defensively rather than
  // trusted — a stale local cache or a future merge should not silently
  // pick the wrong one.
  return (
    [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1) ??
    null
  );
}

/** Whether the current state — not the history — is waiting on a person. */
export function needsHumanReview(doc: MemberDoc): boolean {
  const latest = latestRecommendation(doc);
  return (
    latest?.kind === "coach_review" && latest?.status === "needs_coach_review"
  );
}
