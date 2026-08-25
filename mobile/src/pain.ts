/**
 * What she says about pain, and who it should reach.
 *
 * Pain was a checkbox. Every report — a twinge the morning after, a sharp
 * catch in a knee that made her stop — produced the same two things: the
 * movement paused, and a message saying her coach would review it before she
 * repeated it.
 *
 * Both halves were wrong.
 *
 * A boolean cannot tell the difference between soreness and injury, so the
 * careful response and the excessive one were the same response. And the
 * promise was frequently false: an uncoached member is the default, and
 * nobody was going to review anything. Telling someone a person will look at
 * their pain when no person will is worse than telling them nothing.
 *
 * ## What this does and does not do
 *
 * It **routes**. It decides how far to step back and who should hear about
 * it. It does not diagnose, does not name a cause, and does not prescribe —
 * no ice, no stretches, no "it is probably just". Those are a clinician's
 * words and this is a wellness app.
 *
 * The routing is deliberately blunt, and errs toward caution: the cost of
 * over-reacting is a member who does one fewer exercise this week, and the
 * cost of under-reacting is an injury the app helped along.
 */

export type PainSite =
  | "knee"
  | "hip"
  | "back"
  | "shoulder"
  | "neck"
  | "ankle"
  | "elsewhere";

export type PainKind = "sharp" | "ache" | "tightness";
export type PainTiming = "during" | "after";

export interface PainReport {
  site: PainSite;
  kind: PainKind;
  timing: PainTiming;
  /** Whether it stopped her. Her own judgement, and the strongest signal here. */
  stopped: boolean;
  /** Anything she wanted to add, in her words. Never parsed. */
  note?: string;
}

export const PAIN_SITES: { id: PainSite; label: string }[] = [
  { id: "knee", label: "Knee" },
  { id: "hip", label: "Hip" },
  { id: "back", label: "Back" },
  { id: "shoulder", label: "Shoulder" },
  { id: "neck", label: "Neck" },
  { id: "ankle", label: "Ankle" },
  { id: "elsewhere", label: "Somewhere else" },
];

export const PAIN_KINDS: { id: PainKind; label: string; detail: string }[] = [
  { id: "sharp", label: "Sharp", detail: "A catch, or a stab" },
  { id: "ache", label: "An ache", detail: "Dull, and there while you moved" },
  { id: "tightness", label: "Tight", detail: "Stiff rather than painful" },
];

export const PAIN_TIMINGS: { id: PainTiming; label: string }[] = [
  { id: "during", label: "While I was moving" },
  { id: "after", label: "Afterwards" },
];

/** How far to step back, and who should hear. */
export interface PainRoute {
  /** Stop offering this movement until a person decides otherwise. */
  pause: boolean;
  /** Worth saying plainly that a clinician should look at it. */
  seekCare: boolean;
  /** Only ever true when she actually has a coach. */
  coachReview: boolean;
  /** The heading she sees. */
  title: string;
  /** What happens next, in her language, with no advice in it. */
  body: string;
}

/**
 * The response to one report.
 *
 * Three bands, and the line between them is how much the pain interrupted
 * her rather than how bad she rated it. "Did you have to stop" is a question
 * people answer honestly; "rate your pain one to ten" is not.
 */
export function routePain(
  report: PainReport,
  context: { coached: boolean; movement: string },
): PainRoute {
  const { coached, movement } = context;

  /* Whoever will actually read it. Never a promise of a person who does not
     exist — that was the old copy's failure. */
  const willBeSeen = coached
    ? " Your coach will see this before you are offered it again."
    : " It stays paused until you decide otherwise.";

  /* Sharp pain, or pain that stopped her, is the band where the app should
     stop being clever. Both are reasons to have someone look at it. */
  if (report.kind === "sharp" || report.stopped)
    return {
      pause: true,
      seekCare: true,
      coachReview: coached,
      title: "Leave this one for now",
      body:
        `${movement} is paused.` +
        willBeSeen +
        " Pain that is sharp, or that makes you stop, is worth having someone look at properly — a doctor or a physiotherapist, not an app.",
    };

  /* An ache while moving: step back from the movement, but this is ordinary
     and does not need a clinic. */
  if (report.kind === "ache" && report.timing === "during")
    return {
      pause: true,
      seekCare: false,
      coachReview: coached,
      title: "Paused for now",
      body:
        `${movement} is paused.` +
        willBeSeen +
        " If it keeps happening with other movements too, it is worth mentioning to a doctor.",
    };

  /* Tightness, or an ache the next day. Common, and not a reason to remove
     a movement she may simply be new to. */
  return {
    pause: false,
    seekCare: false,
    coachReview: false,
    title: "Noted",
    body:
      "Stiffness and a bit of an ache afterwards are normal when something is new." +
      ` ${movement} stays in your plan, and the lighter version is there if you want it.` +
      " If it turns sharp, or starts stopping you, tell us then.",
  };
}

/**
 * A one-line summary for a coach, or for her own history.
 *
 * Reads as a sentence rather than a set of fields, because the person
 * reading it is scanning a list and not filling in a form.
 */
export function describePain(report: PainReport): string {
  const site = PAIN_SITES.find((s) => s.id === report.site)?.label ?? "Pain";
  const kind =
    report.kind === "sharp"
      ? "sharp pain"
      : report.kind === "ache"
        ? "an ache"
        : "tightness";
  const when = report.timing === "during" ? "during" : "after";
  return `${site}: ${kind} ${when}${report.stopped ? ", had to stop" : ""}`;
}
