import type {
  DailyAction,
  Member,
  Message,
  PulseEntry,
  RadarBucket,
  RadarEvent,
  Session,
} from "./types";

/**
 * Radar rule definitions — §10 of the V0 architecture.
 *
 * Every rule states its trigger in plain language and is evaluated against
 * live data. There is no score, no model, and nothing Deepika cannot audit
 * by reading one sentence. That constraint is deliberate: an opaque risk
 * score would be easier to build and impossible to trust.
 */

export interface RadarRule {
  id: string;
  name: string;
  bucket: RadarBucket;
  trigger: string;
  suggestedAction: string;
  enabled: boolean;
}

export const radarRules: RadarRule[] = [
  {
    id: "R01",
    name: "No recent interaction",
    bucket: "attention",
    trigger: "No completed action, pulse or message for 72 hours",
    suggestedAction: "Send a low-pressure check-in. Consider assigning Comeback Week.",
    enabled: true,
  },
  {
    id: "R02",
    name: "Movement slipping",
    bucket: "attention",
    trigger: "Two or more planned movement sessions not completed in a rolling 7 days",
    suggestedAction: "Ask what got in the way. Offer the Minimum version or reschedule.",
    enabled: true,
  },
  {
    id: "R03",
    name: "Low energy pattern",
    bucket: "attention",
    trigger: "Energy 2 or below on 3 of the last 4 recorded days",
    suggestedAction: "Review sleep, workload and symptoms. Adapt the week. Refer if concerning.",
    enabled: true,
  },
  {
    id: "R04",
    name: "Sleep concern",
    bucket: "attention",
    trigger: "Self-rated sleep 2 or below for 3 or more of the last 7 days",
    suggestedAction: "Reduce intensity where appropriate. Distinguish waking hot from waking anxious.",
    enabled: true,
  },
  {
    id: "R05",
    name: "Member flagged something",
    bucket: "attention",
    trigger: "Member reported a symptom, pain, or asked a question needing review",
    suggestedAction: "Review promptly. Coach within scope, or refer.",
    enabled: true,
  },
  {
    id: "R06",
    name: "Message unanswered",
    bucket: "attention",
    trigger: "Member message unread or unanswered beyond the coach response window",
    suggestedAction: "Reply, or schedule a reply time.",
    enabled: true,
  },
  {
    id: "R07",
    name: "Session within 24 hours",
    bucket: "prepare",
    trigger: "A 1:1 or supervised session is scheduled in the next 24 hours",
    suggestedAction: "Open the generated session prep pack.",
    enabled: true,
  },
  {
    id: "R08",
    name: "Comeback detected",
    bucket: "celebrate",
    trigger: "First meaningful action after 3 or more inactive days",
    suggestedAction: "Recognise the return. Do not mention the gap.",
    enabled: true,
  },
  {
    id: "R09",
    name: "Quiet progress",
    bucket: "celebrate",
    trigger: "Minimum actions met consistently for 2 weeks without prompting",
    suggestedAction: "Recognise it, and consider progressing the plan.",
    enabled: true,
  },
  {
    id: "R10",
    name: "Assessment incomplete",
    bucket: "admin",
    trigger: "Baseline assessment below 80% complete after week 2",
    suggestedAction: "Complete the missing sections together during the next 1:1.",
    enabled: true,
  },
];

export function evaluateRadar(
  members: Member[],
  actions: DailyAction[],
  pulses: PulseEntry[],
  messages: Message[],
  sessions: Session[],
  rules: RadarRule[],
  resolvedIds: string[]
): RadarEvent[] {
  const events: RadarEvent[] = [];
  const on = (id: string) => rules.find((r) => r.id === id)?.enabled;
  const rule = (id: string) => rules.find((r) => r.id === id)!;

  const push = (
    memberId: string,
    ruleId: string,
    detail: string
  ) => {
    const r = rule(ruleId);
    const id = `${memberId}-${ruleId}`;
    events.push({
      id,
      memberId,
      ruleId: r.id,
      ruleName: r.name,
      trigger: r.trigger,
      bucket: r.bucket,
      detail,
      suggestedAction: r.suggestedAction,
      resolved: resolvedIds.includes(id),
      snoozed: false,
    });
  };

  for (const m of members) {
    const mine = actions.filter((a) => a.memberId === m.id);
    const myPulses = pulses.filter((x) => x.memberId === m.id);
    const myMessages = messages.filter((x) => x.memberId === m.id);

    // R01 — silence
    const touched = [
      ...mine.filter((a) => a.completed && a.completed !== "rest").map((a) => a.dayOffset),
      ...myPulses.map((x) => x.dayOffset),
      ...myMessages.filter((x) => x.from === "member").map((x) => x.dayOffset),
    ];
    // Someone who has never recorded anything has no gap to measure, and a
    // sentinel dressed up as a day count ("nothing for 99 days") would send
    // Deepika chasing a member who joined this morning. Say what is actually
    // true instead, and only once she has had a few days to start.
    const lastTouch = touched.length ? Math.max(...touched) : null;
    if (on("R01")) {
      if (lastTouch === null) {
        if (m.week >= 1) push(m.id, "R01", "Nothing recorded yet.");
      } else if (lastTouch <= -3) {
        push(m.id, "R01", `Nothing recorded for ${Math.abs(lastTouch)} days.`);
      }
    }

    // R02 — movement slipping
    const missedMovement = mine.filter(
      (a) =>
        a.dayOffset >= -7 &&
        a.workoutId !== undefined &&
        (a.completed === "rest" || a.completed === null) &&
        a.dayOffset < 0
    );
    if (on("R02") && missedMovement.length >= 2) {
      push(
        m.id,
        "R02",
        `${missedMovement.length} planned movement sessions not completed in the last 7 days.`
      );
    }

    // R03 — low energy
    const recent = myPulses.filter((x) => x.dayOffset >= -4).sort((a, b) => b.dayOffset - a.dayOffset);
    const lowEnergy = recent.filter((x) => x.energy <= 2).length;
    if (on("R03") && lowEnergy >= 3) {
      push(m.id, "R03", `Energy 2 or below on ${lowEnergy} of the last ${recent.length} recorded days.`);
    }

    // R04 — sleep. `sleep === 0` means she only left a one-tap mood and never
    // rated sleep, so it is not evidence of anything and is excluded.
    const week = myPulses.filter((x) => x.dayOffset >= -7 && x.sleep >= 1);
    const poorSleep = week.filter((x) => x.sleep <= 2).length;
    if (on("R04") && poorSleep >= 3) {
      push(m.id, "R04", `Sleep rated 2 or below on ${poorSleep} days this week.`);
    }

    // R05 — flagged symptom
    const flagged = myPulses.filter((x) => x.dayOffset >= -7 && x.symptoms.length > 0);
    if (on("R05") && flagged.length >= 2) {
      const all = Array.from(new Set(flagged.flatMap((f) => f.symptoms)));
      push(m.id, "R05", `Reported: ${all.join(", ")}.`);
    }

    // R06 — unanswered
    const unread = myMessages.filter((x) => x.from === "member" && !x.read);
    if (on("R06") && unread.length > 0) {
      push(m.id, "R06", `${unread.length} message${unread.length > 1 ? "s" : ""} awaiting a reply.`);
    }

    // R07 — session prep
    const upcoming = sessions.filter(
      (s) => s.memberId === m.id && s.status === "scheduled" && s.dayOffset >= 0 && s.dayOffset <= 1
    );
    if (on("R07") && upcoming.length > 0) {
      const s = upcoming[0];
      push(m.id, "R07", `${s.type} ${s.dayOffset === 0 ? "today" : "tomorrow"} at ${s.time}.`);
    }

    // R08 — comeback
    const done = mine
      .filter((a) => a.completed && a.completed !== "rest")
      .map((a) => a.dayOffset)
      .sort((a, b) => b - a);
    if (on("R08") && done.length >= 2 && done[0] - done[1] >= 3 && done[0] >= -1) {
      push(m.id, "R08", `First action after ${done[0] - done[1]} inactive days.`);
    }

    // R09 — quiet progress
    const completions = mine.filter((a) => a.completed && a.completed !== "rest");
    const skips = mine.filter((a) => a.completed === "rest");
    if (on("R09") && completions.length >= 4 && skips.length === 0 && m.engagement === "strong") {
      push(m.id, "R09", `${completions.length} consecutive completions, no missed actions.`);
    }

    // R10 — admin
    if (on("R10") && m.assessmentComplete < 80 && m.week >= 2) {
      push(m.id, "R10", `Baseline assessment ${m.assessmentComplete}% complete.`);
    }
  }

  return events;
}

export const bucketMeta: Record<
  RadarBucket,
  { label: string; blurb: string; tone: string; dot: string }
> = {
  attention: {
    label: "Needs attention",
    blurb: "Something changed and a person should look at it.",
    tone: "text-attention",
    dot: "bg-attention",
  },
  prepare: {
    label: "Prepare",
    blurb: "A conversation is coming. The prep is already written.",
    tone: "text-ink-soft",
    dot: "bg-ink-soft",
  },
  celebrate: {
    label: "Celebrate",
    blurb: "Reach out because it went well, not because it went wrong.",
    tone: "text-effort-stretch",
    dot: "bg-effort-target",
  },
  admin: {
    label: "Administrative",
    blurb: "Housekeeping. No urgency.",
    tone: "text-ink-faint",
    dot: "bg-rest",
  },
};
