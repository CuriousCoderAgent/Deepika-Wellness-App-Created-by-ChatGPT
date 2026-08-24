/**
 * Training for something with a date on it.
 *
 * The dose ladder in `lib/adaptation.ts` moves sets and reps. It is the right
 * model for getting stronger and it cannot express any of what a race block
 * needs: weekly volume, a long run, easy versus hard days, a cutback week, a
 * taper. Handing a Hyrox goal to that ladder would not produce bad training —
 * it would produce *strength* training with a race label on it, which is a
 * more expensive kind of wrong because it looks like an answer.
 *
 * So this is a second progression model, alongside rather than replacing.
 *
 * ## Why these numbers are rules and not opinions
 *
 * Every constant below is long-established, widely published endurance
 * coaching practice rather than anything invented here or improvised by a
 * model. That is what makes it safe to encode:
 *
 * - **Roughly 10% weekly volume increase.** The most durable guideline in
 *   distance running. The mechanism is that connective tissue adapts more
 *   slowly than the cardiovascular system, so the engine outruns the tendons
 *   and the tendons are what break.
 * - **A cutback week every fourth week.** Adaptation happens during recovery.
 *   Three weeks up, one week down is the standard shape.
 * - **The long run stays a bounded share of weekly volume**, scaled to the
 *   event. A long run that is most of the week is a weekly injury; a long run
 *   capped at a third of a modest week leaves a marathoner under-prepared.
 *   See `LONG_RUN_SHARE`.
 * - **Never add volume and intensity in the same week.** Two stressors at
 *   once is the classic way to break a build.
 * - **Mostly easy.** The 80/20 split is one of the better-evidenced findings
 *   in endurance training, and beginners almost universally run their easy
 *   days too hard.
 * - **A taper.** Two to three weeks of reduced volume with some intensity
 *   retained. Arriving tired is the most common way a first marathon goes
 *   wrong.
 *
 * ## What this deliberately does not do
 *
 * It does not set paces, heart-rate zones or race targets. Those depend on
 * testing and on the individual, and a plausible-looking pace prescription is
 * exactly the kind of confident wrongness this architecture exists to
 * prevent. Sessions are described by *effort* — easy, steady, hard — which is
 * how a beginner should be running anyway.
 *
 * It also refuses rather than improvises when the base is not there. Sixteen
 * weeks is not enough to take someone from nothing to a marathon, and saying
 * so is the useful answer.
 */

/** What she is training for. */
export type EnduranceEvent = "5k" | "10k" | "half" | "marathon" | "hyrox";

export interface EventProfile {
  event: EnduranceEvent;
  /** Weeks until the event. */
  weeksAway: number;
  /** Honest current weekly running volume, in kilometres. */
  currentWeeklyKm: number;
  /** Days a week she can realistically train. */
  daysPerWeek: number;
}

/* ------------------------------------------------------------------ */
/* What each event actually asks of someone                            */
/* ------------------------------------------------------------------ */

interface EventShape {
  label: string;
  /** Weekly volume that makes the distance comfortable rather than survivable. */
  targetWeeklyKm: number;
  /** Longest single run in the block. */
  peakLongRunKm: number;
  /** Minimum weekly volume to start a block at all, safely. */
  minimumBaseKm: number;
  /** Weeks needed from that base. Below this the honest answer is no. */
  minimumWeeks: number;
  /** Weeks of taper before the day. */
  taperWeeks: number;
}

const EVENTS: Record<EnduranceEvent, EventShape> = {
  "5k": {
    label: "5k",
    targetWeeklyKm: 25,
    peakLongRunKm: 8,
    minimumBaseKm: 5,
    minimumWeeks: 6,
    taperWeeks: 1,
  },
  "10k": {
    label: "10k",
    targetWeeklyKm: 35,
    peakLongRunKm: 14,
    minimumBaseKm: 10,
    minimumWeeks: 8,
    taperWeeks: 1,
  },
  half: {
    label: "half marathon",
    targetWeeklyKm: 50,
    peakLongRunKm: 20,
    minimumBaseKm: 20,
    minimumWeeks: 12,
    taperWeeks: 2,
  },
  marathon: {
    label: "marathon",
    targetWeeklyKm: 65,
    peakLongRunKm: 32,
    minimumBaseKm: 30,
    minimumWeeks: 16,
    taperWeeks: 3,
  },
  hyrox: {
    // Eight 1km runs alternating with eight stations. The distinguishing
    // demand is running *under fatigue* — "compromised running" — so the
    // running volume is lower than a half but never trained fresh.
    label: "Hyrox",
    targetWeeklyKm: 30,
    peakLongRunKm: 12,
    minimumBaseKm: 10,
    minimumWeeks: 10,
    taperWeeks: 1,
  },
};

/* ------------------------------------------------------------------ */
/* The rules                                                           */
/* ------------------------------------------------------------------ */

/** Connective tissue adapts slower than the engine. This is the brake. */
const MAX_WEEKLY_INCREASE = 0.1;
/** Three weeks up, one week down. Adaptation happens in the recovery. */
const CUTBACK_EVERY = 4;
const CUTBACK_FACTOR = 0.75;
/**
 * How much of the week the long run may be.
 *
 * A long run that is most of the week is a weekly injury — but the familiar
 * "no more than a third" figure comes from high-mileage running, and applying
 * it to someone peaking at 65km caps their longest run at 23km. That is not a
 * conservative marathon plan, it is an under-prepared one: conventional plans
 * peak around 30–32km, and arriving at 42km having never run past 23 is its
 * own kind of harm.
 *
 * So the share scales with how long the event is. Lower-mileage marathon
 * runners genuinely do run 40–45% of their week in one go, and that is the
 * accepted trade for getting the distance in the legs.
 */
const LONG_RUN_SHARE: Record<EnduranceEvent, number> = {
  "5k": 0.3,
  "10k": 0.35,
  half: 0.4,
  marathon: 0.45,
  // Hyrox never runs far in one piece — the demand is eight separate
  // kilometres on tired legs, which the compromised session trains instead.
  hyrox: 0.3,
};

export type SessionKind =
  | "easy"
  | "long"
  | "tempo"
  | "intervals"
  | "stations"
  | "compromised"
  | "rest";

export interface PlannedSession {
  kind: SessionKind;
  /** Distance where one applies. Absent for station work. */
  km?: number;
  /** In her language, and about effort rather than pace. */
  description: string;
}

export interface EnduranceWeek {
  /** 1-based week of the block. */
  week: number;
  totalKm: number;
  isCutback: boolean;
  isTaper: boolean;
  sessions: PlannedSession[];
  /** One sentence explaining why this week looks like this. */
  rationale: string;
}

/**
 * Whether this block is possible in the time available.
 *
 * Returns a reason when it is not. Sixteen weeks does not take somebody from
 * nothing to a marathon, and a plan that pretends otherwise is how people get
 * hurt — the honest answer is a nearer target, which is also a better first
 * experience.
 */
export function assessFeasibility(
  profile: EventProfile,
): { ok: true } | { ok: false; reason: string; suggestion: string } {
  const shape = EVENTS[profile.event];

  if (profile.weeksAway < shape.minimumWeeks)
    return {
      ok: false,
      reason: `A ${shape.label} block needs about ${shape.minimumWeeks} weeks and you have ${profile.weeksAway}.`,
      suggestion:
        profile.event === "marathon"
          ? "A half marathon on that date is a realistic target, and a marathon later is still there."
          : "A shorter distance on that date, or the same distance a bit later.",
    };

  if (profile.currentWeeklyKm < shape.minimumBaseKm)
    return {
      ok: false,
      reason: `Most ${shape.label} plans assume you are already running about ${shape.minimumBaseKm}km a week, and you are at ${profile.currentWeeklyKm}km.`,
      suggestion: `Build to ${shape.minimumBaseKm}km a week first — that is its own goal, and it is the thing that makes the block work.`,
    };

  return { ok: true };
}

/**
 * What one week of the block looks like.
 *
 * Volume is computed from where she started rather than from where the plan
 * wishes she was, so the 10% brake actually binds. Weeks are capped at the
 * event's target volume — more is not better, and the target already
 * describes a comfortable finish rather than a survivable one.
 */
export function planWeek(profile: EventProfile, week: number): EnduranceWeek {
  const shape = EVENTS[profile.event];
  const taperStartsAt = profile.weeksAway - shape.taperWeeks + 1;
  const isTaper = week >= taperStartsAt;
  const isCutback = !isTaper && week % CUTBACK_EVERY === 0;

  // Compound the increase from her real starting point over *building* weeks
  // only. Counting cutback weeks as though they had also progressed makes the
  // week after a cutback jump well past the 10% brake — 18km to 29km in one
  // step in the case that caught this — and the error compounds every fourth
  // week for the length of the block. A cutback is a pause in progression,
  // not a discount applied to progression that happened anyway.
  const weeksElapsed = week - 1;
  const cutbacksSoFar = Math.floor(weeksElapsed / CUTBACK_EVERY);
  const buildingWeeks = weeksElapsed - cutbacksSoFar;
  const uncapped =
    profile.currentWeeklyKm * (1 + MAX_WEEKLY_INCREASE) ** buildingWeeks;
  let totalKm = Math.min(uncapped, shape.targetWeeklyKm);

  if (isCutback) totalKm *= CUTBACK_FACTOR;
  if (isTaper) {
    // Volume falls away; the last week is small. Intensity is kept in the
    // sessions below rather than removed, which is what a taper actually is.
    const weeksOut = profile.weeksAway - week;
    totalKm *= 0.5 ** (shape.taperWeeks - weeksOut);
  }
  totalKm = Math.round(totalKm);

  const longKm = Math.min(
    Math.round(totalKm * LONG_RUN_SHARE[profile.event]),
    shape.peakLongRunKm,
  );

  const sessions = buildSessions(profile, shape, totalKm, longKm, {
    isCutback,
    isTaper,
  });

  return {
    week,
    totalKm,
    isCutback,
    isTaper,
    sessions,
    rationale: isTaper
      ? "Less running, same sharpness. Arriving fresh matters more than any session you could add now."
      : isCutback
        ? "A lighter week on purpose. This is where the last three weeks turn into fitness."
        : `Building steadily — about ${totalKm}km, with most of it easy.`,
  };
}

function buildSessions(
  profile: EventProfile,
  shape: EventShape,
  totalKm: number,
  longKm: number,
  flags: { isCutback: boolean; isTaper: boolean },
): PlannedSession[] {
  const sessions: PlannedSession[] = [];
  const days = Math.max(2, Math.min(6, profile.daysPerWeek));

  sessions.push({
    kind: "long",
    km: longKm,
    description: `${longKm}km at a pace where you could hold a conversation. Slower than feels right is correct.`,
  });

  // Hyrox is the one event where the running must be practised tired, because
  // that is the whole demand of the race.
  if (profile.event === "hyrox") {
    sessions.push({
      kind: "compromised",
      km: 4,
      description:
        "Four rounds: 1km easy, then a station straight after. Running on tired legs is the skill the race actually tests.",
    });
    sessions.push({
      kind: "stations",
      description:
        "Station work — sled, carries, wall balls, lunges. Heavy enough to be honest, light enough to keep moving.",
    });
  }

  // One quality session, and never during a cutback: adding intensity to a
  // recovery week defeats the recovery, and stacking volume with intensity is
  // the classic way to break a build.
  if (!flags.isCutback && days >= 3) {
    sessions.push(
      flags.isTaper
        ? {
            kind: "intervals",
            km: 5,
            description:
              "Short and sharp — a few fast minutes with full recovery. Enough to stay sharp, not enough to tire you.",
          }
        : {
            kind: "tempo",
            km: Math.max(4, Math.round(totalKm * 0.2)),
            description:
              "Comfortably hard — you could speak in short sentences, not hold a conversation.",
          },
    );
  }

  const used = sessions.reduce((sum, session) => sum + (session.km ?? 0), 0);
  const remaining = Math.max(0, totalKm - used);
  const easyRuns = Math.max(1, days - sessions.length);
  const perEasyRun = Math.round(remaining / easyRuns);

  for (let i = 0; i < easyRuns && perEasyRun > 0; i++) {
    sessions.push({
      kind: "easy",
      km: perEasyRun,
      description: `${perEasyRun}km easy. If you are not sure it is easy enough, slow down.`,
    });
  }

  sessions.push({
    kind: "rest",
    description: "A full rest day. This is part of the plan, not a gap in it.",
  });

  return sessions;
}
