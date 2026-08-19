import type { Article, Member } from "./types";

/**
 * Article matching.
 *
 * Same principle as `lib/radar.ts`: readable rules, no score, no model, and
 * every match carries the sentence that explains it. A member should be able
 * to look at a suggested read and see exactly which thing she told us put it
 * there.
 *
 * Deliberately not AI. V0 has no AI (invariant 10), and there is a second
 * reason beyond that: article selection here is driven by health context, so
 * anything opaque choosing what a woman reads about her own body is a worse
 * product than something she can audit — even if the opaque version were
 * better at picking.
 */

export interface ArticleMatch {
  article: Article;
  /** Plain-language reason, shown to the member. */
  reason: string;
}

const hasAny = (haystack: string[], needles?: string[]) =>
  !!needles?.some((n) => haystack.some((h) => h.toLowerCase().includes(n.toLowerCase())));

export function matchArticles(m: Member, all: Article[]): ArticleMatch[] {
  const matched: ArticleMatch[] = [];

  for (const a of all) {
    const { match } = a;
    let hit = false;

    if (hasAny([m.lifeStage], match.lifeStage)) hit = true;
    if (hasAny(m.goals, match.goal)) hit = true;
    if (hasAny(m.constraints.concat(m.wontDo), match.constraint)) hit = true;
    if (hasAny(m.medical.concat(m.medications), match.medical)) hit = true;
    if (match.moduleIds?.some((id) => m.activeModuleIds.includes(id))) hit = true;

    // minAge is a floor on an already-matched article, never a match on its own.
    if (hit && match.minAge !== undefined && m.age < match.minAge) hit = false;

    if (hit) matched.push({ article: a, reason: a.whyThis });
  }

  return matched;
}

/** Everything else, so the reading list is never a dead end. */
export function otherArticles(m: Member, all: Article[]): Article[] {
  const matchedIds = matchArticles(m, all).map((x) => x.article.id);
  return all.filter((a) => !matchedIds.includes(a.id));
}
