/**
 * Sign-up as a short conversation instead of a form.
 *
 * The constraint that shapes this whole file: **the app can only act on five
 * things.** Goals, the minutes she has, how active she has been, anything to
 * work around, and when she wants reminding. A conversation that gathers a rich
 * picture of someone's life and then hands the generator nothing it can use is
 * worse than the form, because it implies a personalisation that will not
 * arrive.
 *
 * So this is a conversation with a job. The model asks in her language and
 * hears what she means — "I'm on my feet all day at the shop" is an activity
 * level, "my knee plays up on stairs" is a caution — and every turn returns the
 * structured fields extracted so far. It stops as soon as it has them.
 *
 * Guardrails, in the order they matter:
 *
 * 1. **Bounded turns.** Eight member messages, then it stops and offers the
 *    form. A conversation that wanders is a conversation someone abandons.
 * 2. **Extraction, not chat.** Every response is schema-constrained: the next
 *    question plus the fields so far. There is no free-text channel where a
 *    plan, a diagnosis, or a promise could be improvised.
 * 3. **It never answers.** Asked "should I be doing cardio or weights?", it
 *    says that comes next and returns to its question. Advice during sign-up is
 *    advice given before the readiness screen has been seen.
 * 4. **Fields are sanitised here.** Minutes are clamped, goals matched against
 *    the known list, free text truncated. Whatever the model returns, what
 *    reaches the document is the same shape the form produces.
 *
 * The readiness screen still runs afterwards, unchanged and not conversational.
 * A safety screen should read identically to everyone.
 */

import OpenAI from "openai";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { readSessionToken, sessionCookieName } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** After this many member messages, hand over to the form. */
const MAX_TURNS = 8;

/** The same seven the form offers, so downstream code sees one vocabulary. */
const KNOWN_GOALS = [
  "Steadier energy",
  "Feel stronger",
  "Improve mobility",
  "Manage stress",
  "Sleep more consistently",
  "Support hormonal or life-stage wellbeing",
  "Improve endurance",
];

const ACTIVITY_LEVELS = [
  "Mostly sitting",
  "Lightly active",
  "Moderately active",
  "Very active",
];

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "complete", "fields"],
  properties: {
    /** One short question, or a closing line when complete. */
    reply: { type: "string" },
    complete: { type: "boolean" },
    fields: {
      type: "object",
      additionalProperties: false,
      required: [
        "goals",
        "availableMinutes",
        "activityLevel",
        "movementCaution",
        "preferredCheckIn",
      ],
      properties: {
        goals: { type: "array", items: { type: "string" }, maxItems: 3 },
        availableMinutes: { type: ["number", "null"] },
        activityLevel: { type: ["string", "null"] },
        movementCaution: { type: ["string", "null"] },
        preferredCheckIn: { type: ["string", "null"] },
      },
    },
  },
} as const;

const INSTRUCTIONS = `You are helping a woman set up a wellness app, in conversation, before she starts.

Your only purpose is to establish five things:
1. goals — up to three, matched to this list: ${KNOWN_GOALS.join("; ")}
2. availableMinutes — realistically, on an ordinary day
3. activityLevel — one of: ${ACTIVITY_LEVELS.join("; ")}
4. movementCaution — anything that hurts, or that she needs the plan to work around
5. preferredCheckIn — morning or evening

Ask about ONE thing at a time, in plain warm language, one or two sentences. Never present a numbered list of options unless she seems stuck. Hear what she means rather than what she literally said: "I'm on my feet all day" is an activity level; "my knee plays up on the stairs" is a caution; "maybe twenty minutes if the kids are asleep" is availableMinutes.

Return every field you have established so far on every turn, including ones from earlier messages. Use null for anything not yet known. Set complete to true only when all five are established, or when she clearly wants to stop.

You must not: give exercise, medical, or nutrition advice; suggest what she should do; describe a plan; comment on weight, appearance, diet or body shape; diagnose anything; discuss symptoms beyond noting a caution; or promise a result. If she asks what she should do, say that comes next once you know a little more, and continue.

If she mentions chest pain, dizziness, fainting, surgery, pregnancy, or a heart condition, do not react or advise. Note it in movementCaution and continue — a proper health screen follows this conversation and will ask her directly.`;

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

/**
 * Force the model's answer into the shape the rest of the app expects.
 *
 * Whatever comes back, what leaves here is what the form would have produced.
 * A goal that is not on the list is dropped rather than invented into the
 * member's record.
 */
function sanitiseFields(raw: unknown) {
  const input = (raw ?? {}) as Record<string, unknown>;
  const goals = Array.isArray(input.goals)
    ? input.goals
        .map((goal) =>
          KNOWN_GOALS.find(
            (known) => known.toLowerCase() === String(goal).trim().toLowerCase(),
          ),
        )
        .filter((goal): goal is string => Boolean(goal))
        .slice(0, 3)
    : [];

  const minutesRaw = Number(input.availableMinutes);
  const availableMinutes =
    Number.isFinite(minutesRaw) && minutesRaw > 0
      ? Math.max(5, Math.min(120, Math.round(minutesRaw)))
      : null;

  const activityLevel =
    ACTIVITY_LEVELS.find(
      (level) =>
        level.toLowerCase() === String(input.activityLevel ?? "").trim().toLowerCase(),
    ) ?? null;

  const caution =
    typeof input.movementCaution === "string" && input.movementCaution.trim()
      ? input.movementCaution.trim().slice(0, 200)
      : null;

  const checkIn = String(input.preferredCheckIn ?? "").toLowerCase();
  const preferredCheckIn =
    checkIn === "morning" || checkIn === "evening" ? checkIn : null;

  return { goals, availableMinutes, activityLevel, movementCaution: caution, preferredCheckIn };
}

/** Complete only when the app actually has what it needs to build a plan. */
function fieldsAreComplete(fields: ReturnType<typeof sanitiseFields>): boolean {
  return Boolean(
    fields.goals.length &&
      fields.availableMinutes &&
      fields.activityLevel &&
      fields.preferredCheckIn,
  );
}

export async function POST(req: Request) {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json(
      { error: "Conversational sign-up is not switched on.", useForm: true },
      { status: 503 },
    );

  const raw = await req.text();
  if (raw.length > 16_384)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let body: { messages?: { role: string; content: string }[] };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));

  const memberTurns = messages.filter((m) => m.role === "user").length;
  if (memberTurns > MAX_TURNS)
    return NextResponse.json({
      reply:
        "Let's not make this a long questionnaire — you can fill in the rest in a moment and change any of it later.",
      complete: true,
      exhausted: true,
      fields: sanitiseFields({}),
    });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_ONBOARDING_MODEL || "gpt-5",
      store: false,
      input: [
        { role: "developer", content: INSTRUCTIONS },
        ...(messages.length
          ? messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          : [{ role: "user" as const, content: "(she has just opened the app)" }]),
      ],
      text: {
        format: {
          type: "json_schema",
          name: "onboarding_turn",
          strict: true,
          schema,
        },
      },
    });

    const parsed = JSON.parse(response.output_text) as {
      reply?: unknown;
      complete?: unknown;
      fields?: unknown;
    };
    const fields = sanitiseFields(parsed.fields);
    const reply = String(parsed.reply ?? "").trim().slice(0, 400);

    return NextResponse.json({
      reply: reply || "Tell me a little about what you would like to change.",
      // The model's own sense of completion is not trusted on its own: the
      // fields either exist or they do not.
      complete: Boolean(parsed.complete) && fieldsAreComplete(fields),
      fields,
      turnsLeft: Math.max(0, MAX_TURNS - memberTurns),
    });
  } catch (err) {
    console.error(
      "[onboarding] conversation failed",
      err instanceof Error ? err.name : "UnknownError",
    );
    // Sign-up must never be blocked by a model. Fall back to the form.
    return NextResponse.json(
      {
        error: "Let's use the short form instead — it takes a minute.",
        useForm: true,
      },
      { status: 503 },
    );
  }
}
