/**
 * Asking Vera something.
 *
 * The safety rules live in `lib/coach-ai.ts` and are tested there. This route
 * is the plumbing that puts them in the right order, and the order is the
 * whole point:
 *
 *   1. Is this an emergency?      → fixed reply, no model, no exceptions
 *   2. Is this out of scope?      → fixed reply, no model
 *   3. Has she asked too often?   → slow down, no model
 *   4. Only then                  → the model, with her real context
 *   5. Whatever comes back        → sanitised before she sees it
 *
 * Steps 1 and 2 run before the network call rather than after it because they
 * must work when the network call cannot. A member typing "chest pain and my
 * left arm hurts" gets told to call 112 whether or not OpenAI is reachable,
 * whether or not the key is set, and whatever else is in her message.
 *
 * Nothing here writes to the member document. Vera has no route that can
 * change `doseSteps`, `pausedExerciseIds`, `coaching` or the readiness
 * outcome — the conversation is stored by the phone, in `messages`, which is
 * already client-owned. Keeping her out of the derived state entirely is
 * cheaper to reason about than auditing what she is allowed to touch.
 */

import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import OpenAI from "openai";
import { readSessionToken, sessionCookieName } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { isConfigured, readMemberDoc, writeMemberDoc } from "@/lib/db";
import {
  buildCoachContext,
  COACH_INSTRUCTIONS,
  COACH_NAME,
  matchRefusal,
  matchUrgent,
  sanitiseReply,
  UNAVAILABLE_REPLY,
} from "@/lib/coach-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How much conversation is carried back, and how long a turn may be. */
const MAX_HISTORY = 12;
const MAX_MESSAGE = 1000;

/**
 * A rough ceiling per member per hour.
 *
 * In memory, so it resets on deploy and is per-instance — which is fine for
 * what it is guarding, which is a stuck client or a bored member, not an
 * adversary. Anything stronger belongs in the platform, not here.
 */
const RATE = new Map<string, number[]>();
const MAX_PER_HOUR = 40;

function overRate(userId: string): boolean {
  const now = Date.now();
  const hourAgo = now - 3_600_000;
  const recent = (RATE.get(userId) ?? []).filter((at) => at > hourAgo);
  recent.push(now);
  RATE.set(userId, recent);
  return recent.length > MAX_PER_HOUR;
}

async function session() {
  const authorization = (await headers()).get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return readSessionToken(
    bearer ?? (await cookies()).get(sessionCookieName)?.value,
  );
}

/**
 * Store Vera's reply in her record, and hand back the id it was stored under.
 *
 * Vera's replies used to be created on the phone from the text this route
 * returned. They were then discarded on the next sync, every time, because
 * `mergeMemberUpdate` only accepts *new* client-authored messages where
 * `from === "member"` — a deliberate rule, so a phone cannot fabricate a
 * message from a coach. Vera is not a coach, but she is not the member
 * either, so her words fell into the gap: the member's side of the
 * conversation survived and Vera's half vanished.
 *
 * Relaxing that filter would have been the wrong fix. It would let a client
 * post anything it liked as `from: "ai"`, and a coach reading a fabricated
 * "Vera said to take 50mg" in a member's record is exactly the failure the
 * rule exists to prevent.
 *
 * So the exchange is written here instead, server-side, with server-issued
 * ids. The client stores what it is given rather than inventing it, which
 * means the ids already exist by the time anything syncs and the strict
 * filter preserves them untouched. Vera's words are now authored by the
 * server, which is the only place they can be trusted to come from.
 *
 * Failing to persist is not worth failing the answer over: she still sees the
 * reply, it is simply not kept. That is a better outcome than an error where
 * a reply should be.
 */
async function persistReply(
  userId: string,
  reply: string,
): Promise<{ id: string } | null> {
  if (!isConfigured()) return null;
  try {
    const doc = await readMemberDoc(userId);
    if (!doc) return null;
    const replyId = `message-ai-${randomUUID()}`;
    await writeMemberDoc(userId, {
      ...doc,
      // Only Vera's half. Her question already reaches the document by the
      // ordinary route — mergeMemberUpdate accepts new client messages from
      // "member" — so writing it here too would store it twice, once under
      // each id.
      messages: [
        ...(doc.messages ?? []),
        {
          id: replyId,
          memberId: userId,
          from: "ai",
          kind: "text",
          body: reply,
          dayOffset: 0,
          time: "just now",
          read: true,
        },
      ],
    });
    return { id: replyId };
  } catch (err) {
    console.error(
      "[coach] could not store the exchange",
      err instanceof Error ? err.name : "UnknownError",
    );
    return null;
  }
}

export async function POST(req: Request) {
  const user = await session();
  if (!user)
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "member")
    return NextResponse.json(
      { error: `${COACH_NAME} is a member feature.` },
      { status: 403 },
    );

  const raw = await req.text();
  if (raw.length > 16_384)
    return NextResponse.json({ error: "Message too long." }, { status: 400 });

  let body: { message?: unknown; history?: unknown };
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const message = String(body.message ?? "")
    .trim()
    .slice(0, MAX_MESSAGE);
  if (!message)
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });

  /* 1. Emergencies, before anything else can fail. --------------------- */
  const urgent = matchUrgent(message);
  if (urgent) {
    // Kept, and deliberately so. If somebody described chest pain to this app
    // it belongs in the record, both because she may want to show it to
    // someone and because we should be able to see it happened.
    const stored = await persistReply(user.sub, urgent.reply);
    return NextResponse.json({
      reply: urgent.reply,
      urgent: true,
      category: urgent.category,
      messageId: stored?.id,
    });
  }

  /* 2. Questions that need a clinician. -------------------------------- */
  const refusal = matchRefusal(message);
  if (refusal) {
    const stored = await persistReply(user.sub, refusal);
    return NextResponse.json({
      reply: refusal,
      refused: true,
      messageId: stored?.id,
    });
  }

  /* 3. Slow down a client that has got stuck. -------------------------- */
  if (overRate(user.sub))
    return NextResponse.json({
      reply:
        "Let's pick this up in a little while — I have answered a lot in the last hour and I would rather give you a considered reply than a fast one.",
      throttled: true,
    });

  if (!process.env.OPENAI_API_KEY)
    return NextResponse.json({ reply: UNAVAILABLE_REPLY, unavailable: true });

  /* 4. Her real context, then the model. ------------------------------- */
  let context = "";
  if (isConfigured()) {
    try {
      const doc = await readMemberDoc(user.sub);
      if (doc) context = buildCoachContext(doc);
    } catch {
      // Answering generally is better than not answering. Vera is told below
      // when she has no context, so she will not invent any.
    }
  }

  const history = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (turn): turn is { role: string; content: string } =>
        Boolean(turn) &&
        typeof turn === "object" &&
        ((turn as { role?: unknown }).role === "user" ||
          (turn as { role?: unknown }).role === "assistant") &&
        typeof (turn as { content?: unknown }).content === "string",
    )
    .slice(-MAX_HISTORY)
    .map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content.slice(0, MAX_MESSAGE),
    }));

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_COACH_MODEL || "gpt-5",
      store: false,
      input: [
        { role: "developer", content: COACH_INSTRUCTIONS },
        {
          role: "developer",
          content: context
            ? `What you know about her right now. You may repeat these figures; you may not invent others.\n\n${context}`
            : "You could not load her plan this time. Say so rather than guessing at any detail of it.",
        },
        ...history,
        { role: "user", content: message },
      ],
    });

    const reply = sanitiseReply(response.output_text);
    const stored = await persistReply(user.sub, reply);
    return NextResponse.json({ reply, messageId: stored?.id });
  } catch (err) {
    console.error(
      "[coach] reply failed",
      err instanceof Error ? err.name : "UnknownError",
    );
    // Never a 500. An unreachable model is a quiet answer, not a broken app.
    return NextResponse.json({ reply: UNAVAILABLE_REPLY, unavailable: true });
  }
}
