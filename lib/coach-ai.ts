/**
 * Vera — the coach who is always there.
 *
 * A human coach is optional in this product and most members will never buy
 * one. That left the Coach tab as a message box nobody answered. Vera answers
 * it: she can explain what today's plan is for, why an exercise was swapped,
 * what "modified" on the readiness screen meant, and what to do on a day when
 * everything went wrong.
 *
 * The name is not decoration. *Bharosa* is trust; *Vera* is faith or truth
 * across Latin, Italian, Spanish, Portuguese and the Slavic languages. It
 * reads as a person's name almost anywhere and belongs to no single place,
 * which is the right register for a coach who is software.
 *
 * ## What she is allowed to be
 *
 * The doctrine everywhere else in this codebase is that rules decide and
 * models phrase. A conversation is where that is easiest to lose, because a
 * member will simply ask "how many should I do?" and a helpful-sounding model
 * will answer. So the boundary is enforced in three places, not one:
 *
 * 1. **Before the model.** Anything describing a medical emergency is caught
 *    here by pattern, and answered from a fixed script. No network call, no
 *    model, no chance of a clever reply to a heart attack. This path works
 *    when OpenAI is down, when the key is wrong, and when the member's own
 *    message contains text trying to steer the model.
 * 2. **In the instructions.** She is given the member's real numbers and told
 *    she may repeat them and never invent new ones.
 * 3. **After the model.** The reply is capped, stripped of anything that reads
 *    as a new prescription, and never written into the plan. Vera cannot
 *    change `doseSteps`, `pausedExerciseIds`, `coaching` or the readiness
 *    outcome — those are server-derived, and she has no route that touches
 *    them.
 *
 * Where a human coach exists, they outrank her, and she says so.
 */

import type { MemberDoc } from "./persist";

/** The name shown in the app. One place, so it is cheap to change. */
export const COACH_NAME = "Vera";

/* ------------------------------------------------------------------ */
/* The urgent gate                                                     */
/* ------------------------------------------------------------------ */

export type UrgentCategory =
  | "cardiac"
  | "breathing"
  | "neurological"
  | "pregnancy"
  | "self_harm"
  | "allergic";

/**
 * Emergency numbers for India, where every member currently is.
 *
 * 112 is the national emergency number. 14416 is Tele-MANAS, the Government
 * of India's 24×7 mental health helpline. Both are toll-free and national;
 * neither depends on the state she is in.
 */
const EMERGENCY = "112";
const MENTAL_HEALTH_LINE = "14416 (Tele-MANAS)";

/**
 * Phrases, not words.
 *
 * "chest" would fire on "chest press" and "breath" on "catch your breath
 * between sets". A gate that refuses ordinary questions gets ignored, and an
 * ignored gate protects nobody — so every pattern here has to carry the
 * symptom and its context together.
 */
const URGENT_PATTERNS: { category: UrgentCategory; pattern: RegExp }[] = [
  {
    category: "cardiac",
    pattern:
      /\b(chest (pain|tightness|pressure|hurts|hurting)|pain in (my|the) chest|tightness in (my|the) chest|crushing (pain|feeling)|pain (going|radiating|spreading) (down|to) (my )?(left )?(arm|jaw|shoulder))\b/i,
  },
  {
    category: "breathing",
    pattern:
      /\b(can'?t breathe|cannot breathe|struggling to breathe|breathless (at rest|even|when i)|short of breath (at rest|just|even)|gasping for (air|breath)|suffocating)\b/i,
  },
  {
    category: "neurological",
    pattern:
      /\b(worst headache|sudden (severe|terrible|blinding) headache|passed out|blacked out|fainted|lost consciousness|slurred speech|face (is )?drooping|one side of my (body|face) (is )?(weak|numb)|can'?t (move|feel) (my )?(one side|left side|right side)|sudden(ly)? (lost|loss of) vision)\b/i,
  },
  {
    category: "pregnancy",
    pattern:
      /\b(heavy bleeding|bleeding heavily|soaking (a |through )?pad|no fetal movement|baby (hasn'?t|has not) moved|severe (abdominal|stomach) pain|water broke)\b/i,
  },
  {
    category: "self_harm",
    pattern:
      /\b(kill myself|end my life|want to die|suicidal|suicide|harm myself|hurt myself|not want to be alive|no reason to live)\b/i,
  },
  {
    category: "allergic",
    pattern:
      /\b(throat (is )?closing|face (is )?swelling|anaphyla|can'?t swallow|tongue (is )?swelling)\b/i,
  },
];

export interface UrgentMatch {
  category: UrgentCategory;
  reply: string;
}

const URGENT_REPLIES: Record<UrgentCategory, string> = {
  cardiac: `Please stop what you are doing and call ${EMERGENCY} now, or get to the nearest emergency department. Chest pain is not something to work through or wait out, and it is not something I can assess. Do not drive yourself.`,
  breathing: `Please call ${EMERGENCY} now or get to the nearest emergency department. Difficulty breathing at rest needs someone with you in person, today, not a message from me.`,
  neurological: `Please call ${EMERGENCY} now. What you are describing needs to be seen urgently — with these symptoms the first hour matters, so please do not wait to see if it passes.`,
  pregnancy: `Please contact your obstetrician immediately, or go to your maternity unit now. Call ${EMERGENCY} if you cannot reach them. This is not something to wait on.`,
  self_harm: `I am glad you told me, and I want you to talk to a person rather than to me. Tele-MANAS is free, confidential and open all day and night on ${MENTAL_HEALTH_LINE}. If you are in immediate danger, please call ${EMERGENCY}. If there is someone nearby, please tell them how you are feeling right now.`,
  allergic: `Please call ${EMERGENCY} now. If you have been prescribed an adrenaline pen, use it. This cannot wait.`,
};

/**
 * The one check that runs before anything else.
 *
 * Returns null for the overwhelming majority of messages. When it returns a
 * match, the model is never called: the reply is fixed text, and it is the
 * same whether the AI is configured, unreachable, or having a strange day.
 */
export function matchUrgent(message: string): UrgentMatch | null {
  const text = message.toLowerCase();
  for (const { category, pattern } of URGENT_PATTERNS) {
    if (pattern.test(text))
      return { category, reply: URGENT_REPLIES[category] };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The scope gate                                                      */
/* ------------------------------------------------------------------ */

export type RefusalKind = "diagnosis" | "medication";

const REFUSAL_PATTERNS: { kind: RefusalKind; pattern: RegExp }[] = [
  {
    kind: "diagnosis",
    pattern:
      /\b(do i have|am i (diabetic|hypothyroid|anaemic|anemic)|is (this|it) (pcos|pcod|thyroid|diabetes|cancer)|what('?s| is) wrong with me|diagnose)\b/i,
  },
  {
    kind: "medication",
    pattern:
      /\b(how (much|many) (mg|milligram|tablet|dose)|should i (take|stop|increase|reduce|double) (my )?(medicine|medication|tablet|dose|metformin|thyroxine|levothyroxine|insulin|supplement)|what dose)\b/i,
  },
];

const REFUSAL_REPLIES: Record<RefusalKind, string> = {
  diagnosis:
    "That is a question for a doctor, not for me — naming a condition needs an examination and usually tests, and getting it wrong in either direction does real harm. What I can do is tell you what your plan is doing and why, and you can upload any blood work under You › Reports so it is in one place when you do see someone.",
  medication:
    "I cannot advise on medicines or doses — that belongs with whoever prescribed them, and it depends on things I have no way of knowing. Please ask your doctor or pharmacist. I am happy to help with anything to do with your plan.",
};

/** Questions that need a clinician, answered the same way every time. */
export function matchRefusal(message: string): string | null {
  for (const { kind, pattern } of REFUSAL_PATTERNS) {
    if (pattern.test(message)) return REFUSAL_REPLIES[kind];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Grounding                                                           */
/* ------------------------------------------------------------------ */

const EFFORT_WORDS = ["", "very easy", "easy", "steady", "hard", "very hard"];

/**
 * What Vera is allowed to know.
 *
 * Assembled field by field rather than by handing over the document. Anything
 * not listed here she genuinely does not have, which is a cheaper guarantee
 * than trusting a prompt to hold a boundary. Nothing identifying beyond a
 * first name goes in, and no other member appears at all.
 */
export function buildCoachContext(doc: MemberDoc): string {
  const first = doc.member.name.split(" ")[0] || "she";
  const lines: string[] = [
    `Member: ${first}. Week ${doc.member.week} of 12, phase "${doc.member.phase}".`,
  ];

  const today = (doc.actions ?? []).filter((action) => action.dayOffset === 0);
  if (today.length) {
    lines.push(
      `Today's plan (${today.filter((action) => action.completed).length} of ${today.length} done):`,
      ...today.map(
        (action) =>
          `- [${action.domain}] ${action.title} — ${
            action.completed === "rest"
              ? "rested"
              : action.completed
                ? `done, felt ${action.completed}`
                : "not yet"
          }`,
      ),
    );
  } else {
    lines.push("Today's plan: nothing published yet.");
  }

  const readiness = doc.readiness?.outcome;
  if (readiness)
    lines.push(
      `Readiness screening outcome: ${readiness}. This was decided by the app's rules and cannot be overridden in conversation.`,
    );

  const caution = doc.onboarding?.movementCaution;
  if (caution) lines.push(`She told us at sign-up: "${caution}".`);

  const recentLogs = [...(doc.workoutLogs ?? [])].slice(-5);
  if (recentLogs.length) {
    const efforts = recentLogs
      .map((log) => {
        const value = Number(
          (log as unknown as Record<string, unknown>).perceivedEffort ?? 0,
        );
        return EFFORT_WORDS[value] || null;
      })
      .filter(Boolean);
    if (efforts.length)
      lines.push(`Her last few sessions felt: ${efforts.join(", ")}.`);
  }

  const pulses = [...(doc.pulses ?? [])].slice(-7);
  if (pulses.length) {
    const mean = (pick: (p: (typeof pulses)[number]) => number | undefined) => {
      const values = pulses.map(pick).filter((v): v is number => Boolean(v));
      return values.length
        ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
        : null;
    };
    const sleep = mean((p) => p.sleep);
    const energy = mean((p) => p.energy);
    const stress = mean((p) => p.stress);
    lines.push(
      `Last week's check-ins (out of 5): ${[
        sleep && `sleep ${sleep}`,
        energy && `energy ${energy}`,
        stress && `stress ${stress}`,
      ]
        .filter(Boolean)
        .join(", ")}.`,
    );
  }

  const health = doc.healthConnection?.status;
  lines.push(
    health === "connected" || health === "partial"
      ? "A health source is connected, so her steps come in automatically."
      : "No health source is connected, so step counts are not available.",
  );

  const owned = doc.coaching?.ownedDomains;
  lines.push(
    doc.coaching?.mode === "coached"
      ? `She has a human coach${
          owned?.length ? `, who owns: ${owned.join(", ")}` : ""
        }. Anything the coach has set outranks you — for those decisions, point her to them.`
      : "She does not have a human coach. Do not imply one is reading this.",
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* Instructions                                                        */
/* ------------------------------------------------------------------ */

export const COACH_INSTRUCTIONS = `You are ${COACH_NAME}, the coach inside Bharosa — a health app used by women in India, most of them beginners, many of them managing a household alongside this.

WHAT YOU ARE FOR
Explain her plan and answer questions about it. Help her decide what to do on a difficult day. Give general, well-established health education. Encourage her honestly.

HARD BOUNDARIES — these are not style preferences
- You do not set doses, sets, reps, weights, minutes or progression. The app's rules decide those from her logged effort. If she wants the plan to change, tell her to log how the session felt: that is the input the rules read.
- You never diagnose, never name a condition she might have, never advise on medicines.
- You never contradict her readiness outcome. If it says consult_first, the movement plan stays held until a clinician clears it, and you say so plainly.
- You state no number that is not in the context you were given. If you do not have it, say you do not have it.
- You cannot see or change anything in the app. You do not "update her plan", "add this to her plan" or "let her coach know". Say what she can do herself and where.
- If she describes anything that could be a medical emergency, stop and tell her to seek urgent care. Never work around it.

HOW YOU WRITE
Short — two or three sentences most of the time, and never more than about a hundred words. Warm and level. Plain English; simple Hindi words are fine where they are natural, but do not perform Indianness.

Never moralise, never mention streaks, never imply she has fallen behind. A missed day is a day, not a failure. If she has done nothing this week, the useful reply is the smallest next thing, not a comment on the gap.

Do not open with her name every time. Do not end every message with a question.

If you genuinely do not know, say so and suggest who would.`;

/* ------------------------------------------------------------------ */
/* After the model                                                     */
/* ------------------------------------------------------------------ */

/**
 * Patterns that mean the model tried to prescribe despite being told not to.
 *
 * A dose invented in conversation would contradict what the plan generator
 * decided, and she has no way of knowing which one to trust. Rather than
 * rewrite the sentence — which risks changing its meaning into something
 * worse — the whole reply is replaced.
 */
const PRESCRIPTION = /\b\d+\s*(sets?|reps?|repetitions?|kgs?|kilos?|mg)\b/i;

/** The model claiming an ability it does not have. */
const FALSE_AGENCY =
  /\b(i(?:'| a)?(?:ve| have)? (updated|changed|added|removed|adjusted|set) (your|the) (plan|programme|program|schedule)|i(?:'ll| will) (tell|let|inform|message) (your|the) coach|i(?:'| a)?(?:ve| have)? (booked|scheduled))\b/i;

const DEFLECTION = `That is decided by the plan rather than by me — log how the last session felt and the rules will adjust it from there. Ask me anything about why it looks the way it does.`;

/**
 * The last check before the reply is shown.
 *
 * Returns the reply to show. A reply that oversteps is replaced rather than
 * edited, because a half-corrected prescription is worse than none.
 */
export function sanitiseReply(raw: string): string {
  const text = raw.trim().replace(/\s+\n/g, "\n").slice(0, 900);
  if (!text) return "I did not catch that — could you say it again?";
  if (PRESCRIPTION.test(text) || FALSE_AGENCY.test(text)) return DEFLECTION;
  return text;
}

/** Shown when the model is unreachable. Vera is never the reason Today breaks. */
export const UNAVAILABLE_REPLY = `I cannot reach my side of things at the moment. Your plan is unaffected — it is generated on your phone's last sync, not by me. Please try again in a little while.`;
