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

/**
 * How long a "waiting on a person" flag stays on screen.
 *
 * Nothing anywhere resolves one. There is no queue, no owner, and for an
 * uncoached member — nearly everyone — no person is ever coming. A banner
 * that says someone is looking at this, indefinitely, is untrue after the
 * first day and becomes furniture after the second.
 *
 * Two days is long enough to be seen across a couple of app opens and short
 * enough that it cannot become permanent. When a real review queue exists
 * this should key off that case's status instead of the clock, and this
 * constant should go.
 */
const REVIEW_VISIBLE_DAYS = 2;

/**
 * Whether the current state — not the history — is waiting on a person.
 *
 * Reads only the most recent recommendation, because scanning the whole
 * history meant a single old flag haunted every day after it. It also expires:
 * an account that accumulated flags from a since-fixed trigger would otherwise
 * be stuck showing them forever, since the flag that pinned it is also the
 * newest thing in the list.
 */
export function needsHumanReview(
  doc: MemberDoc,
  now: Date = new Date(),
): boolean {
  const latest = latestRecommendation(doc);
  if (latest?.kind !== "coach_review") return false;
  if (latest.status !== "needs_coach_review") return false;

  const raisedAt = Date.parse(latest.createdAt);
  if (!Number.isFinite(raisedAt)) return false;
  const daysOld = (now.getTime() - raisedAt) / 86_400_000;
  return daysOld < REVIEW_VISIBLE_DAYS;
}
